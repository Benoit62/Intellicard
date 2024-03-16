/*const clickSearchBar= document.getElementById('searbar');
const list = document.getElementById("predefID");

clickSearchBar.addEventListener('click', afficheList); 
// clickSearchBar.addEventListener("mouseleave", cachelist);



// on ajoute un gestionnaire d'evenements au doc:

document.addEventListener('click',clickEnDehors);

function clickEnDehors(event)
{

    if(!clickSearchBar.contains(event.target) && !list.contains(event.target))
    {

        console.log('en dehors de la div ');
        list.style.visibility='hiden';
       list.style.display ='none';
    }
}

function afficheList(){

    console.log('en pleine face');
    list.style.visibility='visible';
    list.style.display ='block';
 
    

};

/*
function cachelist()
{
    list.style.visibility='hidden';
}

*/





