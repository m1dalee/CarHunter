# CarHunter

Alertes **Telegram** pour BMW **M140i** (≤ 30 000 €) et **M4 F82** (≤ 40 000 €, sans cabrio / F83).

Tourne sur **ton PC** via un runner GitHub Actions auto-hébergé — IP résidentielle + profil navigateur persistant pour leboncoin, La Centrale et mobile.de.

## Prérequis PC (Windows)

- [Node.js 20+](https://nodejs.org/)
- [Git](https://git-scm.com/)
- PC **allumé** aux heures planifiées (8h et 20h Paris)

## 1. Secrets Telegram (GitHub)

**Settings** → **Secrets and variables** → **Actions** :

| Secret | Valeur |
|--------|--------|
| `TELEGRAM_BOT_TOKEN` | ton token BotFather |
| `TELEGRAM_CHAT_ID` | `5252735871` |

## 2. Installer le runner sur ton PC

1. Va sur **GitHub** → repo `CarHunter` → **Settings** → **Actions** → **Runners** → **New self-hosted runner**
2. Choisis **Windows** → **x64**, suis les commandes PowerShell affichées :

```powershell
# Exemple (remplace le token par celui affiché sur GitHub)
mkdir C:\actions-runner
cd C:\actions-runner
Invoke-WebRequest -Uri https://github.com/.../actions-runner-win-x64-....zip -OutFile actions-runner-win-x64.zip
Expand-Archive actions-runner-win-x64.zip -DestinationPath .
.\config.cmd --url https://github.com/m1dalee/CarHunter --token <TOKEN> --labels car-hunter
```

3. **Important** : lance le runner en mode **interactif** (pas en service Windows) pour le premier setup captcha :

```powershell
.\run.cmd
```

> En mode service, Chrome ne peut pas ouvrir de fenêtre. Garde `run.cmd` dans une fenêtre PowerShell ou configure le runner pour démarrer à la connexion Windows.

## 3. Config persistante (`C:\CarHunter`)

Crée le dossier et copie la config :

```powershell
mkdir C:\CarHunter\browser-profile -Force
mkdir C:\CarHunter\data -Force
copy .env.example C:\CarHunter\.env
# Édite C:\CarHunter\.env avec ton TELEGRAM_BOT_TOKEN
```

Contenu de `C:\CarHunter\.env` :

```env
TELEGRAM_BOT_TOKEN=ton_token
TELEGRAM_CHAT_ID=5252735871
BROWSER_PROFILE_DIR=C:\CarHunter\browser-profile
BROWSER_HEADLESS=false
```

## 4. Premier run (résoudre les captchas)

1. Runner allumé (`.\run.cmd`)
2. **Actions** → **Car Hunter** → **Run workflow**
3. Une fenêtre Chrome s'ouvre → résous les captchas leboncoin / La Centrale / mobile.de si demandé
4. Une fois OK, passe en mode automatique :

```env
BROWSER_HEADLESS=true
```

## Planification

Automatique **2×/jour** (8h et 20h, Paris) — le PC doit être allumé avec le runner actif.

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

| Site | Runner PC |
|------|-----------|
| AutoScout24 FR + DE | ✅ |
| leboncoin / La Centrale / mobile.de | ✅ (profil persistant) |

## Critères (`config.json`)

- M140i ≤ 30 000 €
- M4 F82 ≤ 40 000 €, sans cabrio / F83
- Pas de limite zone / km

## Dépannage

| Problème | Solution |
|----------|----------|
| Job en attente | Runner éteint → lance `.\run.cmd` dans `C:\actions-runner` |
| Pas de fenêtre Chrome | Runner en service → passe en mode interactif (`run.cmd`) |
| 0 annonce leboncoin | Relance avec `BROWSER_HEADLESS=false`, refais les captchas |
| Cookies expirés | Même procédure — refaire un run interactif |
