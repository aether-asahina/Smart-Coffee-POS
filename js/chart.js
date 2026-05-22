// ═══════════════════════════════════════════
//  js/chart.js  —  Grafik Keuangan (Chart.js)
//  File ini NON-module, dimuat setelah CDN Chart.js
//  Mengambil data dari window._txArr yang di-set oleh app.js
// ═══════════════════════════════════════════

window.renderFinanceChart = function () {
  const ctx = document.getElementById('financeChart');
  if (!ctx) return;

  const txArr      = window._txArr || [];
  const labels     = [];
  const incomeData = [];
  const expenseData = [];

  // 7 hari terakhir
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);

    labels.push(d.toLocaleDateString('id-ID', { day:'2-digit', month:'2-digit' }));

    const key = d.toISOString().split('T')[0];
    let income = 0, expense = 0;

    txArr.forEach(t => {
      if (t.date && t.date.startsWith(key)) {
        if (t.type === 'pemasukan') income  += Number(t.amount);
        else                        expense += Number(t.amount);
      }
    });

    incomeData.push(income);
    expenseData.push(expense);
  }

  // Destroy instance lama sebelum re-render
  if (window.financeChartInstance) {
    window.financeChartInstance.destroy();
    window.financeChartInstance = null;
  }

  const isDark     = document.body.classList.contains('dark');
  const tickColor  = isDark ? '#ccc' : '#444';
  const legendColor = isDark ? '#fff' : '#222';

  window.financeChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: incomeData,
          borderColor: '#48ff00',
          backgroundColor: 'rgba(72,255,0,0.15)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Pengeluaran',
          data: expenseData,
          borderColor: '#ff3b3b',
          backgroundColor: 'rgba(255,59,59,0.12)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: legendColor, font: { family: 'DM Mono' } },
        },
        tooltip: {
          callbacks: {
            label: ctx => ' Rp ' + ctx.parsed.y.toLocaleString('id-ID'),
          },
        },
      },
      scales: {
        x: {
          ticks: { color: tickColor, font: { family: 'DM Mono', size: 11 } },
          grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        },
        y: {
          ticks: {
            color: tickColor,
            font: { family: 'DM Mono', size: 11 },
            callback: v => 'Rp ' + Number(v).toLocaleString('id-ID'),
          },
          grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        },
      },
    },
  });
};

