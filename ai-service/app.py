"""TicketDesk AI service: TF-IDF (char n-grams, robust to Roman Urdu spelling) + logistic regression."""
import csv, os, re
from fastapi import FastAPI
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

app = FastAPI(title="TicketDesk AI")
rows = list(csv.DictReader(open(os.path.join(os.path.dirname(__file__), "train.csv"), encoding="utf8")))
X = [r["text"] for r in rows]

def build(target):
    m = make_pipeline(TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), lowercase=True), LogisticRegression(max_iter=1000, C=8))
    m.fit(X, [r[target] for r in rows])
    return m

cat_model, pri_model = build("category"), build("priority")
# word-level TF-IDF used for keyword extraction (auto-tags)
kw_vec = TfidfVectorizer(token_pattern=r"(?u)\b[a-zA-Z]{4,}\b", stop_words="english", sublinear_tf=True).fit(X)
KW_TERMS = kw_vec.get_feature_names_out()

def keywords(text, n=5):
    row = kw_vec.transform([text]).toarray()[0]
    return [KW_TERMS[i] for i in row.argsort()[::-1][:n] if row[i] > 0]
NEG = ["angry", "worst", "terrible", "unacceptable", "useless", "frustrated", "disappointed", "bakwas", "bekar", "ghalat", "gussa", "pareshan", "tang", "again"]
POS = ["thanks", "thank you", "great", "shukriya", "meharbani", "acha"]

def sentiment(text):
    t = text.lower()
    s = -0.35 * sum(w in t for w in NEG) + 0.3 * sum(w in t for w in POS) - (0.25 if re.search(r"!{2,}", text) else 0)
    s = max(-1.0, min(1.0, s))
    return {"score": round(s, 2), "label": "negative" if s <= -0.3 else "positive" if s >= 0.3 else "neutral"}

class Item(BaseModel):
    text: str

@app.post("/classify")
def classify(item: Item):
    p = cat_model.predict_proba([item.text])[0]
    i = p.argmax()
    return {"category": cat_model.classes_[i], "categoryConfidence": float(p[i]),
            "priority": pri_model.predict([item.text])[0], "sentiment": sentiment(item.text),
            "keywords": keywords(item.text)}

@app.get("/health")
def health():
    return {"ok": True, "samples": len(rows)}
