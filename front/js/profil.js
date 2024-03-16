// Récupérer la référence de l'élément canvas
const canvas = document.getElementById('myChart');

// Créer le contexte du graphique
const ctx = canvas.getContext('2d');

// Données du graphique
const data = {
  labels: dataDays,
  datasets: [
    {
      label: 'Cartes étudiées',
      data: dataCartes,
      backgroundColor: '#f06b4233', // Couleur de fond des barres
      borderColor: '#f06b42', // Couleur de bordure des barres #f06b42
      borderWidth: 1.2, // Épaisseur de la bordure des barres
      fill: true,
      pointRadius:4,
      pointBackgroundColor: "#f06b42"
    }
  ]
};

// Options du graphique
const options = {
  scales: {
    y: {
        beginAtZero: true, // Commencer l'axe Y à 0
        grid: {
            display: false
        }
    },
    x: {
        grid: {
            display: false
        } 
    }
  },
  responsive: true,
  tension: 0.3
};

// Créer l'instance du graphique à barres
const myChart = new Chart(ctx, {
  type: 'line',
  data: data,
  options: options 
});
function toggleMenu() {
  var container = document.querySelector('.donnees');
  var isHidden = container.style.display === 'none';

  if (window.innerWidth < 800) {
    if (isHidden) {
      container.style.display = 'block';
      container.style.animation = 'fade-in 0.3s forwards';
    } else {
      container.style.animation = 'fade-out 0.3s forwards';
      setTimeout(function() {
        container.style.display = 'none';
      }, 200);
    }
  }
}
