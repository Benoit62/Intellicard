var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
        }
    }
    return null;
};



let showError = function(message) {
    $("#error_content").html(message);
    if(window.innerWidth < 800) {
        $('#error_notif').animate({bottom: '15vh'}, 150);
    }
    else {
        $('#error_notif').animate({bottom: '2vh'}, 150);
    }
    $('#error_notif').animate({left: '+=2vh'}, 60);
    $('#error_notif').animate({left: '-=4vh'}, 60);
    $('#error_notif').animate({left: '+=3vh'}, 60);
    $('#error_notif').animate({left: '-=2vh'}, 60);
    $('#error_notif').animate({left: '+=1vh'}, 60);

    setTimeout(() => {
        $('#error_notif').animate({bottom: '-20vh'}, 150);
    }, 4000);
}


function setFlipping() {
    $(".carte").data("flipping", "false");
    $(".carte").click(function(e){
        e.preventDefault()
            
        if(!$(e.target).closest(".comprehension").hasClass("comprehension")) {
            if($(this).data("flipping") === "false") {

                this.classList.toggle('flip');

                if($(this).find(".cartefront").hasClass("hide_card")) {
                    $(this).data("flipping", "true");
                    setTimeout(() => {
                        $(this).find(".carteback").toggleClass('hide_card')
                        $(this).data("flipping", "false");
                    }, 500);
                    $(this).find(".cartefront").toggleClass('hide_card')
                }

                if($(this).find(".carteback").hasClass("hide_card")) {
                    $(this).data("flipping", "true");
                    setTimeout(() => {
                        $(this).find(".cartefront").toggleClass('hide_card')
                        $(this).data("flipping", "false");
                    }, 500);
                    $(this).find(".carteback").toggleClass('hide_card')
                }
            }
        }
    });


    $(".carte_mini").data("flipping", "false");
    $(".carte_mini").click(function(e){
        //e.preventDefault()
        
        if(!$(e.target).closest(".comprehension").hasClass("comprehension") && !$(this).hasClass("noflip")) {
            if($(this).data("flipping") === "false") {

                this.classList.toggle('flip');

                if($(this).find(".cartefront").hasClass("hide_card")) {
                    $(this).data("flipping", "true");
                    setTimeout(() => {
                        $(this).find(".carteback").toggleClass('hide_card')
                        $(this).data("flipping", "false");
                    }, 500);
                    $(this).find(".cartefront").toggleClass('hide_card')
                }

                if($(this).find(".carteback").hasClass("hide_card")) {
                    $(this).data("flipping", "true");
                    setTimeout(() => {
                        $(this).find(".cartefront").toggleClass('hide_card')
                        $(this).data("flipping", "false");
                    }, 500);
                    $(this).find(".carteback").toggleClass('hide_card')
                }
            }
        }
    });
}



function updateProgressBar() {
    console.log("Update progress bar")
    if($(".activities_item").length > 0) {
        $(".activities_item").each(function (index) {
            /*console.log("Resize", this)
            console.log(($(this).next().height()), ($(this).height()))*/
            var style = this.style;
            console.log($(this).next().height())
            style.setProperty('--height', ((($(this).next().outerHeight(true) / 2) + ($(this).outerHeight() / 2)) || 0) + 'px');
            style.setProperty('--width', ((($(this).next().outerWidth(true) / 2) + ($(this).outerWidth(true) / 2) + 10) || 0) + 'px');
        });
    }
}



function setImageForm() {
    $('.photo').change(function (e) {
        const files = this.files;
        console.log(files);
        if(files.length > 0) {
            console.log(files[0])
            //$(this).prev()[0].style.backgroundImage = 'url('+window.URL.createObjectURL(files[0])+')';
            $(this).prev().find(".preview").attr("src", window.URL.createObjectURL(files[0])).show();
            $(this).prev().find(".label_file_icon").hide();
            $(this).prev().find(".delete_file").show();
            $(this).prev().css({
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '0px'
            })
            console.log('update bar')
            setTimeout(() => {
                updateProgressBar();
            }, 200);
        }
    })

    delete_file();
    
}

function setPDFForm() {
    $('.pdf').change(function (e) {
        const files = this.files;
        console.log(files);
        if(files.length > 0) {
            console.log(files[0])
            console.log($(this).prev())
            $(this).prev().find(".preview").attr("data", window.createObjectURL(files[0])).show();
            $(this).prev().find(".label_file_icon").hide();
            $(this).prev().find(".delete_file").show();
            $(this).prev().css({
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '0px'
            })
            setTimeout(() => {
                updateProgressBar();
            }, 200);
        }
    })

    delete_file();

}

function delete_file() {
    
    $('.delete_file').click(function (e) {
        e.preventDefault()
        const label = $(this).closest('.label_file');
        label.next()[0].value = ""
        label.find('.preview').attr("data", '').hide()
        label.find(".label_file_icon").show()
        label.find(".delete_file").hide();
        label.css({
            backgroundColor: '#c18573',
            border: '#f06b42 solid 3px',
            borderRadius: '15px'
        })
        setTimeout(() => {
            updateProgressBar();
        }, 200);
        console.log(label.next()[0].files)
    })
}





function parseQuestionsAndAnswers(input) {
    const lines = input.split('\n');
    const qaPairs = [];

    console.log(lines);

    let currentQuestion = null;
    let currentAnswer = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('Q')) {
            currentQuestion = parsePhrase(line);
        } else if (line.startsWith('R')) {
            currentAnswer = parsePhrase(line);
        }

        if (currentQuestion && currentAnswer) {
            qaPairs.push({
                question: currentQuestion,
                answer: currentAnswer
            });

            currentQuestion = null;
            currentAnswer = null;
        }
    }

    return qaPairs;
}

function parsePhrase(chaine) {
    var indexDeuxPoints = chaine.indexOf(":");
    if (indexDeuxPoints !== -1) {
        var partieApresDeuxPoints = chaine.slice(indexDeuxPoints +1, chaine.length);
        return partieApresDeuxPoints.trim();
    } else {
        // Retourner la chaîne d'origine si ":" n'est pas trouvé
        return chaine.trim();
    }
}