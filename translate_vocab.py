#!/usr/bin/env python3
"""
將 data.js 中所有英文翻譯替換為繁體中文（使用 Google Translate 免費翻譯）。
"""
import json, os, sys, time, urllib.request, urllib.parse, re

DATA_PATH = os.path.join(os.path.dirname(__file__), "js", "data.js")
BATCH_SIZE = 80

def load_data():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    json_str = content.replace("const VOCAB = ", "", 1).strip().rstrip(";")
    return json.loads(json_str)

def save_data(data):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        f.write("const VOCAB = ")
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write(";\n")

def google_translate(text, src="en", dst="zh-TW"):
    """免費呼叫 Google Translate"""
    url = "https://translate.googleapis.com/translate_a/single"
    params = urllib.parse.urlencode({
        "client": "gtx",
        "sl": src,
        "tl": dst,
        "dt": "t",
        "q": text,
    })
    full = f"{url}?{params}"
    req = urllib.request.Request(full, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        sentences = data[0]
        return "".join(s[0] for s in sentences if s[0])
    except Exception as e:
        print(f"  翻譯失敗: {e}")
        return None

def translate_batch_simple(texts):
    """逐句翻譯（Google 免費 API 限制，一次翻一句）"""
    results = []
    for t in texts:
        r = google_translate(t)
        results.append(r if r else t)
        time.sleep(0.15)
    return results

def main():
    data = load_data()

    # 收集所有不重複單字
    all_words = []
    seen = set()
    for lv in data:
        for unit in data[lv]:
            for w in unit["words"]:
                key = f"{lv}::{w['k']}::{w['r']}"
                if key not in seen:
                    seen.add(key)
                    all_words.append({"k": w["k"], "r": w["r"], "en": w["en"], "key": key})

    total = len(all_words)
    print(f"共 {total} 個不重複單字")

    translations = {}
    done = 0

    for i in range(0, total, BATCH_SIZE):
        batch = all_words[i:i+BATCH_SIZE]
        # 把整批英文用換行合成一段，一次翻譯（比較快）
        combined = "\n".join(w["en"] for w in batch)
        print(f"[{done}/{total}] 翻譯 {len(batch)} 個…", end=" ", flush=True)

        result = google_translate(combined)
        if result:
            # 用換行切回來
            lines = [l.strip() for l in result.split("\n") if l.strip()]
            if len(lines) == len(batch):
                for w, zh in zip(batch, lines):
                    translations[w["key"]] = zh
                done += len(batch)
                print("✓")
            else:
                # 行數不對，逐句翻
                print("行數不對，逐句翻…", end=" ")
                fallback = translate_batch_simple([w["en"] for w in batch])
                for w, zh in zip(batch, fallback):
                    translations[w["key"]] = zh
                done += len(batch)
                print("✓")
        else:
            for w in batch:
                translations[w["key"]] = w["en"]
            done += len(batch)
            print("✗ 保留英文")

        time.sleep(0.5)

    # 寫回
    count = 0
    for lv in data:
        for unit in data[lv]:
            for w in unit["words"]:
                key = f"{lv}::{w['k']}::{w['r']}"
                w["zh"] = translations.get(key, w["en"])
                if "en" in w:
                    del w["en"]
                count += 1

    save_data(data)
    print(f"\n完成！已更新 {count} 個單字。")

if __name__ == "__main__":
    main()
