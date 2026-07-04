from pathlib import Path
import json

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = Path("/Users/loki/Desktop/微专业/语义一致性/AIGC视频语义一致性评分结果与统计.xlsx")
OUTPUT = ROOT / "data" / "model-comparison.json"

CATEGORY_MAP = {
    "属性绑定": "属性",
    "动作绑定": "动作",
    "空间关系与交互": "关系",
}


def clean_errors(value):
    if pd.isna(value):
        return []
    return [part.strip() for part in str(value).split("；") if part.strip()]


def main():
    df = pd.read_excel(WORKBOOK, sheet_name="Raw Scores")
    videos = []
    by_id = {}

    for _, row in df.iterrows():
        video_id = str(row["video_id"])
        number = int(video_id[1:])
        model = "seedance2.0" if number % 2 == 1 else "kling3.0"
        item = {
            "prompt_id": str(row["prompt_id"]),
            "video_id": video_id,
            "model": model,
            "source_model": str(row["model"]),
            "category": CATEGORY_MAP.get(str(row["category"]), str(row["category"])),
            "source_category": str(row["category"]),
            "prompt": str(row["prompt"]),
            "video": f"videos/{video_id}.mp4",
            "subject_score": float(row["subject_score"]),
            "attribute_score": float(row["attribute_score"]),
            "action_score": float(row["action_score"]),
            "relation_score": float(row["relation_score"]),
            "scene_score": float(row["scene_score"]),
            "temporal_score": float(row["temporal_score"]),
            "final_score": round(float(row["final_score"]), 1),
            "error_type": clean_errors(row.get("error_type")),
            "reason": str(row["reason"]),
        }
        videos.append(item)
        by_id[video_id] = item

    pairs = []
    for index in range(1, 30, 2):
        seedance = by_id[f"V{index:03d}"]
        kling = by_id[f"V{index + 1:03d}"]
        pairs.append({
            "prompt_id": seedance["prompt_id"],
            "prompt": seedance["prompt"],
            "category": seedance["category"],
            "seedance_video_id": seedance["video_id"],
            "kling_video_id": kling["video_id"],
            "seedance_score": seedance["final_score"],
            "kling_score": kling["final_score"],
            "winner": (
                "Tie"
                if seedance["final_score"] == kling["final_score"]
                else "seedance2.0"
                if seedance["final_score"] > kling["final_score"]
                else "kling3.0"
            ),
        })

    summary = {}
    for model in ["seedance2.0", "kling3.0"]:
        subset = [item for item in videos if item["model"] == model]
        summary[model] = {
            "count": len(subset),
            "average_final_score": round(sum(item["final_score"] for item in subset) / len(subset), 1),
            "average_subject": round(sum(item["subject_score"] for item in subset) / len(subset), 2),
            "average_attribute": round(sum(item["attribute_score"] for item in subset) / len(subset), 2),
            "average_action": round(sum(item["action_score"] for item in subset) / len(subset), 2),
            "average_relation": round(sum(item["relation_score"] for item in subset) / len(subset), 2),
            "average_scene": round(sum(item["scene_score"] for item in subset) / len(subset), 2),
            "average_temporal": round(sum(item["temporal_score"] for item in subset) / len(subset), 2),
        }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(
            {
                "title": "Seedance 2.0 vs Kling 3.0",
                "source": WORKBOOK.name,
                "summary": summary,
                "pairs": pairs,
                "videos": videos,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {len(videos)} videos and {len(pairs)} prompt pairs to {OUTPUT}")


if __name__ == "__main__":
    main()
