<div align="center">

# ☕ Smart Coffee POS

**A point-of-sale and financial management system for a coffee shop, running entirely in the browser.**

Built for *Angkringan Koes Coffee* with vanilla HTML, CSS, and JavaScript. No backend, no build step.

[![Status](https://img.shields.io/badge/status-active-success)](#-development-status)
[![Hosting](https://img.shields.io/badge/hosting-GitHub%20Pages-222?logo=github)](#-getting-started)
[![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black)](#-tech-stack)
[![Chart.js](https://img.shields.io/badge/charts-Chart.js-FF6384?logo=chartdotjs&logoColor=white)](#-tech-stack)

[**🚀 Live Demo**](https://aether-asahina.github.io/Smart-Coffee-POS/)

</div>

---

## 📖 About

Smart Coffee POS helps a small coffee shop run its daily operations: recording transactions, organizing menu and inventory by category, and tracking income and expenses through reports.

It was built for a real use case, **Angkringan Koes Coffee**, and is designed to work on a phone or any browser with no installation and no server. All data is stored locally in the browser.

---

## ✨ Features

- **Point of sale**: record coffee shop transactions
- **Inventory categories**: organize items by coffee shop categories
- **Financial management**: track income and expenses
- **Reports**: charts and summaries powered by Chart.js
- **Role-based access**: separate *admin* and *viewer* roles
- **Offline-friendly**: runs as a static site, with data kept in `localStorage`

---

## 🚀 Getting Started

### Live Demo

**https://aether-asahina.github.io/Smart-Coffee-POS/**

### Run Locally

```bash
git clone https://github.com/aether-asahina/Smart-Coffee-POS.git
cd Smart-Coffee-POS
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Or use Node.js:

```bash
npx serve .
```

### Host Your Own Copy

Fork the repository, then go to *Settings → Pages → Branch `main` / folder `/ (root)` → Save*.

---

## 🗂️ Project Structure

```text
Smart-Coffee-POS/
├── index.html    # Application markup and entry point
├── css/          # Stylesheets
├── script.js     # Application logic (POS, inventory, reports, access roles)
└── README.md
```

---

## 🧰 Tech Stack

| Technology | Usage |
| --- | --- |
| HTML5 | Application structure |
| CSS3 | Layout and interface |
| JavaScript (vanilla) | Application logic |
| Chart.js | Financial reports and charts |
| Browser `localStorage` | Data persistence |
| GitHub Pages | Static hosting |

---

## 🛣️ Development Status

The project is under *active development*.

- [x] Point-of-sale transactions
- [x] Inventory by category
- [x] Financial reporting with charts
- [x] Admin and viewer roles
- [ ] Cloud sync and backup (e.g. Firebase)
- [ ] Export reports (PDF / spreadsheet)
- [ ] Split `script.js` into modules as the app grows

---

## ⚠️ Limitations

- Data lives in the browser's `localStorage`. It is **per device and per browser**, and is lost if the browser data is cleared. Back up important records.
- Because the app has no backend, role-based access is enforced on the client side. It separates what each role *sees* in the interface but is **not a security boundary**.
- Not intended for handling payment card data.

---

## 👤 Author

**Muhammad Naufal Dzakiy** ([@aether-asahina](https://github.com/aether-asahina))

Informatics Student · Developer

---

<div align="center">

*Build. Break. Learn. Repeat.*

</div>
