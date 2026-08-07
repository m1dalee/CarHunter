# CarHunter

App **standalone** — repo GitHub séparé, rien à voir avec SmartData.

Alertes **Telegram** pour BMW **M140i** (≤ 30 000 €) et **M4 F82** (≤ 40 000 €, sans cabrio / F83).

Tourne **automatiquement sur GitHub Actions** — rien à installer sur ton PC.

## Setup (repo `m1dalee/CarHunter`)

### 1. Pousser le code

Depuis **ce dossier** (racine du projet, pas un sous-dossier) :

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/m1dalee/CarHunter.git
git push -u origin main
```

### 2. Secrets Telegram

**Settings** → **Secrets and variables** → **Actions** :

| Secret | Valeur |
|--------|--------|
| `TELEGRAM_BOT_TOKEN` | ton token BotFather |
| `TELEGRAM_CHAT_ID` | `5252735871` |

### 3. Tester

**Actions** → **Car Hunter** → **Run workflow**

## Planification

Automatique **2×/jour** (8h et 20h, Paris).

Manuel : **Actions** → **Run workflow**.

## Message Telegram (exemple)

```
🚗 Car Hunter
🕐 ven. 07 août, 08:00

✨ 2 nouvelles annonces

━━ BMW M140i (1) ━━
🆕 BMW Série 1 M140i
💰 27 500 € · 📍 Lyon, FR
👉 Voir l'annonce
```

## Sites

| Site | GitHub Actions |
|------|----------------|
| AutoScout24 FR + DE | ✅ |
| leboncoin / La Centrale / mobile.de | ⚠️ captcha |

## Critères (`config.json`)

- M140i ≤ 30 000 €
- M4 F82 ≤ 40 000 €, sans cabrio / F83
- Pas de limite zone / km
