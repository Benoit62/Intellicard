//Hide error div
$("#error_notif").click(function(){
    $('#error_notif').animate({bottom: '-10vh'}, 100);
})

///Création de la div erreur
$("body").ready(function () {
    $("body").append(`<div id="error_notif" class="error_notif"><div id="error_content" class="error_content"></div></div>`)
})

// Hide modal
$(".modal").click(function(e){
    let target = e.target;
    if(target.classList.contains('modal')){
        $(target).css("display", "none");
    }
});

$(".load_apercu").each(function(index){
    const content = $(this).data("content")
    generateView($(this), content, true);
});

// Tourner les cartes
setFlipping()

setImageForm()

setPDFForm()

updateProgressBar()

