/* on va mettre les questions / reponses dans un tableau 
tableau qu'on recup en bdd --> id , q , r
dans la map :

id --> quest
id --> rep

On cree un tableau d'objet 
*/

const CardsContainer = document.querySelector(".cardsM");

let tableau = [
    { cle: 'cle1', valeur: 'q1' },
    { cle: 'cle1', valeur: 'r1' },
    { cle: 'cle2', valeur: 'q2' },
    { cle: 'cle2', valeur: 'r2' },
    { cle: 'cle3', valeur: 'q3' },
    { cle: 'cle3', valeur: 'r3' },
];

function comparekey(tableau)
{

     for( let i=0 ; i<tableau.length ; i++)
     {
          for( let j =i; j<tableau.length; j++)
          {
               if(tableau[i].cle === tableau[j].cle)
               {
                 console.log(`ID ${tableau[i].cle} est égal à ID ${tableau[j].cle}`);
               }
               else
               {
                console.log(`ID ${tableau[i].cle} est diff de ID ${tableau[j].cle}`);
               }

          }   
   
     }
}

console.log("fonction");
comparekey(tableau);
