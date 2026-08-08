# CarHunter

Alertes **Telegram** pour BMW **M140i** (≤ 30 000 €) et **M4 F82** (≤ 40 000 €, sans cabrio / F83).

Deux jobs automatiques **2×/jour** (8h et 20h, Paris) :

| Job | Où | Sites |
|-----|-----|-------|
| **Cloud** | GitHub Actions | AutoScout24 — tourne tout seul |
| **Browser** | Ton PC (runner) | leboncoin, La Centrale, mobile.de |

---

## Partie A — Supprimer un mauvais runner

### 1. Sur ton PC

Si une fenêtre `run.cmd` est ouverte → **Ctrl+C** pour l'arrêter.

Puis dans PowerShell :

```powershell
cd C:\actions-runner
.\config.cmd remove
```

Si le dossier existe encore, supprime-le :

```powershell
cd C:\
Remove-Item -Recurse -Force C:\actions-runner
```

> Si tu avais installé le runner **en service Windows** :
> ```powershell
> cd C:\actions-runner
> .\config.cmd remove
> ```
> Puis vérifie dans **Services** (`services.msc`) qu'il n'y a plus de service `GitHub Actions Runner`.

### 2. Sur GitHub

1. Va sur **https://github.com/m1dalee/CarHunter/settings/actions/runners**
2. Clique sur ton runner (ex. `DESKTOP-XXX`)
3. **Remove runner** → confirme

Tu repars de zéro.

---

## Partie B — Installer le runner (correctement)

### Étape 1 — Prérequis PC

- [Node.js 20+](https://nodejs.org/)
- [Git](https://git-scm.com/)
- PC **allumé** à 8h et 20h avec le runner actif

### Étape 2 — Secrets Telegram (GitHub)

**Settings** → **Secrets and variables** → **Actions** :

| Secret | Valeur |
|--------|--------|
| `TELEGRAM_BOT_TOKEN` | ton token BotFather |
| `TELEGRAM_CHAT_ID` | `5252735871` |

### Étape 3 — Créer le runner

1. **https://github.com/m1dalee/CarHunter/settings/actions/runners**
2. **New self-hosted runner** → **Windows** → **x64**
3. Suis les commandes affichées. **Important** : à la config, ajoute le label `car-hunter` :

```powershell
mkdir C:\actions-runner
cd C:\actions-runner
# Copie ici la commande Invoke-WebRequest affichée sur GitHub
# Copie ici la commande Expand-Archive affichée sur GitHub
.\config.cmd --url https://github.com/m1dalee/CarHunter --token <TOKEN_GITHUB> --labels car-hunter
```

Quand GitHub demande le nom du runner → Entrée (défaut OK).

**Group** → Entrée (défaut OK).

**Labels** → vérifie que `car-hunter` est bien listé.

**Work folder** → Entrée (défaut `_work` OK).

**Run as service** → **`N`** (Non) — important pour voir Chrome au premier run.

### Étape 4 — Config persistante

```powershell
mkdir C:\CarHunter\browser-profile, C:\CarHunter\data -Force
notepad C:\CarHunter\.env
```

Colle ceci (remplace `TON_TOKEN_BOTFATHER`) :

```env
TELEGRAM_BOT_TOKEN=TON_TOKEN_BOTFATHER
TELEGRAM_CHAT_ID=5252735871
BROWSER_PROFILE_DIR=C:\CarHunter\browser-profile
BROWSER_HEADLESS=false
```

### Étape 5 — Lancer le runner

```powershell
cd C:\actions-runner
.\run.cmd
```

Tu dois voir : **`Listening for Jobs`** — laisse la fenêtre ouverte.

### Étape 6 — Premier run + captchas

1. **https://github.com/m1dalee/CarHunter/actions** → **Car Hunter** → **Run workflow**
2. Seul le job **`hunt-browser`** part sur ton PC (le job **`hunt-cloud`** tourne sur GitHub)
3. Chrome s'ouvre → résous les captchas leboncoin / La Centrale / mobile.de
4. Vérifie Telegram

### Étape 7 — Mode automatique

Quand les captchas sont OK :

```powershell
notepad C:\CarHunter\.env
```

Passe à :

```env
BROWSER_HEADLESS=true
```

---

## Planification

| Horaire | Cloud (AutoScout24) | PC (autres sites) |
|---------|---------------------|-------------------|
| 8h Paris | ✅ automatique | ✅ si runner actif |
| 20h Paris | ✅ automatique | ✅ si runner actif |

Manuel : **Actions** → **Run workflow**.

---

## Runner au démarrage Windows (optionnel)

1. `Win + R` → `shell:startup`
2. Raccourci vers `C:\actions-runner\run.cmd`

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Job `hunt-browser` en attente (queued) | Lance `.\run.cmd`, PC allumé |
| Job `hunt-cloud` échoue | Vérifie secrets Telegram sur GitHub |
| Pas de fenêtre Chrome | Runner en service → refais install avec **Run as service = N** |
| 0 annonce leboncoin | `BROWSER_HEADLESS=false`, relance, refais captchas |
| Mauvais runner / mauvais labels | Suis **Partie A** puis **Partie B** |

---

## Critères (`config.json`)

- M140i ≤ 30 000 €
- M4 F82 ≤ 40 000 €, sans cabrio / F83
