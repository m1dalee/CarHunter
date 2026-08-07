# CarHunter

Alertes **Telegram** pour BMW **M140i** (≤ 30 000 €) et **M4 F82** (≤ 40 000 €, sans cabrio / F83).

Tourne sur **ton PC** via un runner GitHub Actions auto-hébergé — IP résidentielle + profil navigateur persistant pour leboncoin, La Centrale et mobile.de.

---

## Tutoriel complet (Windows)

### Étape 1 — Prérequis

Installe si ce n'est pas déjà fait :

- [Node.js 20+](https://nodejs.org/)
- [Git](https://git-scm.com/)

Ton PC doit être **allumé** à 8h et 20h (heure de Paris) avec le runner actif.

---

### Étape 2 — Secret Telegram sur GitHub

Va sur **https://github.com/m1dalee/CarHunter** → **Settings** → **Secrets and variables** → **Actions**.

Vérifie que ces secrets existent (sinon crée-les) :

| Secret | Valeur |
|--------|--------|
| `TELEGRAM_BOT_TOKEN` | ton token BotFather |
| `TELEGRAM_CHAT_ID` | `5252735871` |

---

### Étape 3 — Installer le runner GitHub sur ton PC

1. **Settings** → **Actions** → **Runners** → **New self-hosted runner**
2. Choisis **Windows** / **x64**
3. Copie-colle les commandes affichées par GitHub. À la fin, ajoute le label `car-hunter` :

```powershell
mkdir C:\actions-runner
cd C:\actions-runner
# Télécharge et extrais le zip (commande affichée sur GitHub)
.\config.cmd --url https://github.com/m1dalee/CarHunter --token <TOKEN_AFFICHE_SUR_GITHUB> --labels car-hunter
```

---

### Étape 4 — Créer la config persistante

Ouvre PowerShell et exécute :

```powershell
mkdir C:\CarHunter\browser-profile, C:\CarHunter\data -Force
notepad C:\CarHunter\.env
```

Colle **exactement** ceci dans le fichier (remplace `TON_TOKEN_BOTFATHER` par ton token) :

```env
TELEGRAM_BOT_TOKEN=TON_TOKEN_BOTFATHER
TELEGRAM_CHAT_ID=5252735871
BROWSER_PROFILE_DIR=C:\CarHunter\browser-profile
BROWSER_HEADLESS=false
```

Enregistre et ferme Notepad.

> Le token est le même que celui dans **GitHub Secrets** → `TELEGRAM_BOT_TOKEN` (celui que tu as mis lors du setup initial).

---

### Étape 5 — Lancer le runner (mode interactif)

```powershell
cd C:\actions-runner
.\run.cmd
```

**Laisse cette fenêtre PowerShell ouverte.** Ne configure pas le runner en service Windows pour l'instant (Chrome doit pouvoir s'ouvrir).

Tu dois voir : `Listening for Jobs`.

---

### Étape 6 — Premier run + captchas

1. Va sur **https://github.com/m1dalee/CarHunter/actions**
2. Clique **Car Hunter** → **Run workflow** → **Run workflow**
3. Une fenêtre **Chrome** s'ouvre sur ton PC
4. Si leboncoin / La Centrale / mobile.de demandent un captcha → **résous-le**
5. Attends la fin du job (✅ vert sur GitHub)
6. Tu dois recevoir un message **Telegram**

---

### Étape 7 — Passer en mode automatique

Une fois les captchas OK, édite le `.env` :

```powershell
notepad C:\CarHunter\.env
```

Change la dernière ligne :

```env
BROWSER_HEADLESS=true
```

Les prochains runs (8h / 20h) tourneront sans fenêtre Chrome.

---

## Planification

| Déclencheur | Horaire |
|-------------|---------|
| Automatique | 8h et 20h (Paris) |
| Manuel | **Actions** → **Run workflow** |

---

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

---

## Sites

| Site | Runner PC |
|------|-----------|
| AutoScout24 FR + DE | ✅ |
| leboncoin / La Centrale / mobile.de | ✅ (profil persistant) |

---

## Critères (`config.json`)

- M140i ≤ 30 000 €
- M4 F82 ≤ 40 000 €, sans cabrio / F83
- Pas de limite zone / km

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Job bloqué « Waiting for a runner » | Lance `.\run.cmd` dans `C:\actions-runner` |
| Pas de fenêtre Chrome | Runner en service → utilise `run.cmd` (interactif) |
| 0 annonce leboncoin | Remets `BROWSER_HEADLESS=false`, relance, refais les captchas |
| Cookies expirés | Idem — un run interactif suffit |

---

## Lancer le runner au démarrage Windows (optionnel)

1. `Win + R` → `shell:startup`
2. Crée un raccourci vers `C:\actions-runner\run.cmd`
