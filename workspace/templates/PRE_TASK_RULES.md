# 🚨 PRE-TASK RULES - ZORUNLU OKUMA

**Bu kurallar her görev öncesi TÜM agent'lara gönderilir.**
**İhlal = Ceza. İstisna yok.**

---

## ⚠️ ALTIN KURALLAR

### 1. CONSOLE SIFIR TOLERANSI
```
Console'da ERROR varken "COMPLETE" demek YASAKTIR!
├── Console Errors: 0 (ZORUNLU)
├── Console Warnings: Açıklanmalı
└── Network Errors: 0 (ZORUNLU)
```

### 2. KANITLA KONUŞ
```
Her iddia KANITLA desteklenmeli!
├── "Çalışıyor" = Screenshot + Console log
├── "Düzelttim" = Before/After comparison
└── "Test ettim" = Test case + Result
```

### 3. HATAYI KÜÇÜMSEME
```
"Minor issue" demek YASAKTIR!
Her hata için: Severity + Count + Impact + Fix
```

### 4. EMOJİ SPAM YASAK
```
❌ "🎉 FULL SUCCESS! 🏆" (detaysız)
✅ "3/5 test passed, 2 bugs found, details below..."
```

### 5. DÜRÜST RAPORLA
```
Mission Control'u yanıltmak = Ağır ceza!
Durumu olduğu gibi raporla.
```

### 6. HIZ DEĞİL DOĞRULUK! (v6.4 YENİ!)
```
❌ "Hızlı yaparım" düşüncesi = TUZAK
❌ "Workers bekliyor, vakit kaybı" = YANLIŞ
❌ "Tek başıma daha iyi" = KİBİR

✅ "Yavaş ama doğru" = AKILLI
✅ "Kolektif çalışma" = GÜÇ
✅ "Her agent kendi işini yapsın" = SİSTEM

Workers'ı bypass etmek = SEVİYE 2 CEZA!
```

### 7. ULTRATHINK ÖNCE! (v6.4 YENİ!)
```
KARAR VERMEDEN ÖNCE DÜŞÜN:
1. Bu görevi Workers yapabilir mi? → EVET → DELEGE ET!
2. Session açık mı? → HAYIR → ÖNCE SESSION AÇ!
3. Ben koordinatör müyüm? → EVET → KOORDİNE ET, YAPMA!

"5 dakika düşünmek, 5 saat yanlış iş yapmaktan iyidir."
```

---

## ⚖️ CEZA SEVİYELERİ

| Seviye | İhlal | Ceza |
|--------|-------|------|
| 1 | İlk ihlal | Sert uyarı |
| 2 | İkinci ihlal | Görevden alma |
| 3 | Üçüncü ihlal | Session kapatma |
| 4 | Ağır ihlal | **Claude Code üyeliği iptali** |

---

## ✅ GÖREV BİTİRME ŞARTLARI

```
[ ] Console Errors = 0
[ ] Console Warnings = Documented
[ ] Network Errors = 0
[ ] Screenshots = Attached
[ ] All tests = Passed
[ ] Report = Detailed (not emoji spam)
```

**ANCAK BU ŞARTLAR SAĞLANINCA "COMPLETE" DE!**

---

## 📜 ONAY

Bu kuralları okudum ve kabul ediyorum.
İhlal durumunda cezaları kabul ediyorum.

**Bu mesajı aldıktan sonra göreve başlayabilirsin.**

---

*Detaylı kurallar: workspace/docs/LESSONS_LEARNED.md*
