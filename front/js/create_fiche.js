let activeElement = "";


$('#color').on('input change', function () {
    activeElement.css('color', this.value)
    activeElement.focus()
    console.log(activeElement)
})

$('#underline').click(function () {
    console.log(activeElement.css('text-decoration'));
    (activeElement.css('text-decoration').includes("underline")) ? activeElement.css('text-decoration', 'none') : activeElement.css('text-decoration', 'underline')
    activeElement.focus()
})

$('#bold').click(function () {
    console.log(activeElement.css('font-weight'));
    (activeElement.css('font-weight') == "800") ? activeElement.css('font-weight', '400') : activeElement.css('font-weight', '800')
    activeElement.focus()
})

$('#center').click(function () {
    console.log(activeElement.css('text-align'));
    (activeElement.css('text-align').includes("center")) ? activeElement.css('text-align', 'start') : activeElement.css('text-align', 'center')
    activeElement.focus()
})

$('.fas').click(function () {
    var fontSize = parseInt(activeElement.css("font-size"));
    if(fontSize > 1){
        switch($(this).data('type')){
            case 'up':
                fontSize = fontSize + 1 + "px";
                break;
            case 'down':
                fontSize = fontSize - 1 + "px";
                break;
            default:
                break;
        }
    }
    activeElement.css('font-size', fontSize);
    activeElement.focus()
})


$('.add_list').click(function(){
    let elemToInsert = '';
    switch($(this).data('type')){
        case 'ul':
            elemToInsert = '<ul class="global_elem" data-type="ul"></ul>'
            type = "ul";
            break;
        case 'ol':
            elemToInsert = '<ol class="global_elem" data-type="ol"></ol>'
            type = "ol";
            break;
        default:
            break;
    }
    let ul = $(elemToInsert).appendTo('#file');
    let li = $('<li style="display: none;"></li>').appendTo(ul);
    addList(ul, li, type)
})

function addList(ul, liPrev){
    let li = $('<li class="txt" style="font-size: 13px" contenteditable="true">Puce numéro '+($(ul).children().length)+'</li>').insertAfter(liPrev).focus();
    
    activeElement = li;
    
    $(li).keypress(function (e) {
        if(e.keyCode == 13 && !e.shiftKey)
        {
            e.preventDefault()
            $(li).blur()
            activeElement = ""
        }
        if(e.keyCode == 13 && e.shiftKey) {
            e.preventDefault()
            addList(ul, li)
        }
    });
    $(li).click(function (e) {
        activeElement = $(this);
    });
}

$('.add_text').click(function(){
    let elemToInsert = '';
    switch($(this).data('type')){
        case 'title':
            elemToInsert = '<h2 class="global_elem txt" data-type="title" contenteditable="true">Votre titre</h2>';
            break;
        case 'text':
            elemToInsert = '<p class="global_elem txt" data-type="text" style="font-size: 13px;" contenteditable="true">Votre texte</p>';
            break;
        case 'def':
            elemToInsert = '<p class="txt global_elem def" data-type="def" style="font-size: 13px;" contenteditable="true">Votre définition</p>';
            break;
        default:
            break;
    }
    let insertedElement = $(elemToInsert).appendTo('#file').focus();

    if(!insertedElement.hasClass("txt"))insertedElement = insertedElement.find(".txt")
        
    activeElement = insertedElement;

    console.log(insertedElement, activeElement)
        
    insertedElement.keypress(function (e) {
        if(e.keyCode == 13 && !e.shiftKey)
        {
            e.preventDefault()
            insertedElement.blur()
            activeElement = ""
        }
    });
    insertedElement.click(function (e) {
        activeElement = $(this);
    });
})

/*$('#gras').click(function(e) {
    e.preventDefault()
    let selection = window.getSelection();
    console.log(window.getSelection())
    if (selection.rangeCount > 0) {
        $(selection.getRangeAt(0).startContainer.parentNode).find("span").contents().unwrap();
        selection = window.getSelection();
        var range = selection.getRangeAt(0);
        var span = document.createElement('span');
        span.style.fontWeight = "bolder";
        range.surroundContents(span);
    }
});*/



function getFiche(){
    let fiche = [];
    $('#file').find(".global_elem").each(function (index) {
        let eachElem = {
            nodeName: this.nodeName,
            text: this.innerText,
            type: this.dataset.type,
            color: this.style.color,
            underline: this.style.textDecoration.includes("underline"),
            bold: this.style.fontWeight,
            center: this.style.textAlign.includes("center"),
            size: $(this).css("font-size")
        }
        if($(this).data('type') == "ol" || $(this).data('type') == "ul") {
            eachElem = {
                nodeName: this.nodeName,
                type: this.dataset.type,
                childrens:[]
            }
            $(this).find(".txt").each(function (index) {
                let eachElemChild = {
                    nodeName: this.nodeName,
                    text: this.innerText,
                    color: this.style.color,
                    underline: this.style.textDecoration.includes("underline"),
                    bold: this.style.fontWeight,
                    center: this.style.textAlign.includes("center"),
                    size: $(this).css("font-size")
                }
                eachElem.childrens.push(eachElemChild)
            })
        }
        fiche.push(eachElem)
    })
    return fiche
}

function generateView(apercu, fiche, small){
    scale = 1;
    if(small)scale = 0.5;
    console.log("Let's generate small view !")
    apercu.empty()
    fiche.forEach(function (elem) {
        switch (elem.nodeName) {
            case "H2":
                apercu.append('<h2 style="font-size: ' + (parseInt(parseInt(elem.size)*scale)) + 'px; text-align: ' + (elem.center ? "center" : "") + '; text-decoration: ' + (elem.underline ? "center" : "") + '; font-weight: ' + elem.bold + '; color: ' + (elem.color ? elem.color : "white") + '">' + elem.text + '</h2>')
                break;
            case "P":
                if (elem.type && elem.type == "def") {
                    apercu.append('<p class="def" style="font-size: ' + (parseInt(parseInt(elem.size)*scale)) + 'px; text-align: ' + (elem.center ? "center" : "") + '; text-decoration: ' + (elem.underline ? "center" : "") + '; font-weight: ' + elem.bold + '; color: ' + (elem.color ? elem.color : "white") + '">' + elem.text + '</p>')
                    break;
                }
                apercu.append('<p style="font-size: ' + (parseInt(parseInt(elem.size)*scale)) + 'px; text-align: ' + (elem.center ? "center" : "") + '; text-decoration: ' + (elem.underline ? "center" : "") + '; font-weight: ' + elem.bold + '; color: ' + (elem.color ? elem.color : "white") + '">' + elem.text + '</p>')
                break;
            case "OL":
                if (elem.type && elem.type == "ol") {
                    let parent = $('<ol></ol>').appendTo(apercu);
                    elem.childrens.forEach(function (elem) {
                        parent.append('<li style="font-size: ' + (parseInt(parseInt(elem.size)*scale)) + 'px; text-align: ' + (elem.center ? "center" : "") + '; text-decoration: ' + (elem.underline ? "center" : "") + '; font-weight: ' + elem.bold + '; color: ' + (elem.color ? elem.color : "white") + '">' + elem.text + '</li>');
                    })
                }
                break;
            case "UL":
                if (elem.type && elem.type == "ul") {
                    let parent = $('<ul></ul>').appendTo(apercu);
                    elem.childrens.forEach(function (elem) {
                        parent.append('<li style="font-size: ' + (parseInt(parseInt(elem.size)*scale)) + 'px; text-align: ' + (elem.center ? "center" : "") + '; text-decoration: ' + (elem.underline ? "center" : "") + '; font-weight: ' + elem.bold + '; color: ' + (elem.color ? elem.color : "white") + '">' + elem.text + '</li>');
                    })
                }
                break;
            default:
                break;
        }
    })
}

function displayFiche(fiche){
    $('#modal').css("display", "flex")
    generateView($("#fiche"), fiche, false)
}

function regenerateModificationView(fiche){
    console.log("Let's generate full view !")
    const file = $('#file')
    fiche.forEach(function (elem) {
        switch (elem.nodeName) {
            case "H2":
                let insertedElement = $('<h2 class="global_elem txt" data-type="title" contenteditable="true" style="text-align: ' + (elem.center ? "center" : "") + '; text-decoration: ' + (elem.underline ? "center" : "") + '; font-weight: ' + elem.bold + '; color: ' + (elem.color ? elem.color : "white") + '">' + elem.text + '</h2>').appendTo(file)
                insertedElement.keypress(function (e) {
                    if(e.keyCode == 13 && !e.shiftKey)
                    {
                        e.preventDefault()
                        insertedElement.blur()
                        activeElement = ""
                    }
                });
                insertedElement.click(function (e) {
                    activeElement = $(this);
                });
                break;
            case "P":
                if (elem.type && elem.type == "def") {
                    let insertedElement = $('<p  class="txt global_elem def" data-type="def" contenteditable="true" style="text-align: ' + (elem.center ? "center" : "") + '; text-decoration: ' + (elem.underline ? "center" : "") + '; font-weight: ' + elem.bold + '; color: ' + (elem.color ? elem.color : "white") + '">' + elem.text + '</p>').appendTo(file)
                    insertedElement.keypress(function (e) {
                        if(e.keyCode == 13 && !e.shiftKey)
                        {
                            e.preventDefault()
                            insertedElement.blur()
                            activeElement = ""
                        }
                    });
                    insertedElement.click(function (e) {
                        activeElement = $(this);
                    });
                    break;
                }
                let insertedElement2 = $('<p  class="global_elem txt" data-type="text" contenteditable="true" style="text-align: ' + (elem.center ? "center" : "") + '; text-decoration: ' + (elem.underline ? "center" : "") + '; font-weight: ' + elem.bold + '; color: ' + (elem.color ? elem.color : "white") + '">' + elem.text + '</p>').appendTo(file)
                insertedElement2.keypress(function (e) {
                    if(e.keyCode == 13 && !e.shiftKey)
                    {
                        e.preventDefault()
                        insertedElement.blur()
                        activeElement = ""
                    }
                });
                insertedElement2.click(function (e) {
                    activeElement = $(this);
                });
                break;
            case "OL":
                if (elem.type && elem.type == "ol") {
                    let parent = $('<ol class="global_elem" data-type="ol"></ol>').appendTo(file);
                    $('<li style="display: none;"></li>').appendTo(parent);
                    elem.childrens.forEach(function (elem) {
                        let insertedElement = $('<li class="txt" data-type="ol" contenteditable="true" style="font-size: ' + elem.size*scale + '; text-align: ' + (elem.center ? "center" : "") + '; text-decoration: ' + (elem.underline ? "center" : "") + '; font-weight: ' + elem.bold + '; color: ' + (elem.color ? elem.color : "white") + '">' + elem.text + '</li>').appendTo(parent);
                        insertedElement.keypress(function (e) {
                            if(e.keyCode == 13 && !e.shiftKey)
                            {
                                e.preventDefault()
                                $(li).blur()
                                activeElement = ""
                            }
                            if(e.keyCode == 13 && e.shiftKey) {
                                e.preventDefault()
                                addList(ul, li)
                            }
                        });
                        insertedElement.click(function (e) {
                            activeElement = $(this);
                        });
                    })
                }
                break;
            case "UL":
                if (elem.type && elem.type == "ul") {
                    let parent = $('<ul class="global_elem" data-type="ul"></ul>').appendTo(file);
                    elem.childrens.forEach(function (elem) {
                        let insertedElement = $('<li class="txt" data-type="ul" contenteditable="true" style="font-size: ' + elem.size*scale + '; text-align: ' + (elem.center ? "center" : "") + '; text-decoration: ' + (elem.underline ? "center" : "") + '; font-weight: ' + elem.bold + '; color: ' + (elem.color ? elem.color : "white") + '">' + elem.text + '</li>').appendTo(parent);
                        insertedElement.keypress(function (e) {
                            if(e.keyCode == 13 && !e.shiftKey)
                            {
                                e.preventDefault()
                                $(li).blur()
                                activeElement = ""
                            }
                            if(e.keyCode == 13 && e.shiftKey) {
                                e.preventDefault()
                                addList(ul, li)
                            }
                        });
                        insertedElement.click(function (e) {
                            activeElement = $(this);
                        });
                    })
                }
                break;
            default:
                break;
        }
    })
}