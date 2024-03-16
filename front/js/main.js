//fonction pour flip une carte
const carte = document.getElementById('carte');
const back = document.getElementById('back');
const front = document.getElementById('front');

//Autoriser le flip
let allow_flip = true;

/* Auto-évaluation */
let autoeval = document.getElementById('autoevaltab');

autoeval.addEventListener("click",notation);

function notation(event) {
    allow_flip = false;

    let note = event.target.offsetParent.id; //On récupère l'ID de l'enfant (ou presque l'enfant) et on a la note !
    
    console.log(note);
}
/* Fin Auto-évaluation */

//fonction pour cacher la div avec l'id deck quand on clique sur le bouton contenant l'id acces
const acces = document.getElementById('BTN');

const deck = document.getElementById('deck');

carte.addEventListener('click', flip); //quand on clique sur la carte, on lance la fonction flip
acces.addEventListener('click', hide);

function hide(){
    deck.style.display = 'none';
}



function flip(){
    if (allow_flip) {
        carte.classList.toggle('flip');
    } else {
        allow_flip = true;
    }
}