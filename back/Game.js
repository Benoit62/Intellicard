class Game{
    constructor(cartes){

        console.log(cartes)
        this.grille = [];
        let id = 0;

        let grilleTmp = [];
        for(let elem of cartes) {
            grilleTmp.push({
                id_card:elem.id_card,
                text:elem.question,
                img:elem.img_q
            })
            grilleTmp.push({
                id_card:elem.id_card,
                text:elem.answer,
                img:elem.img_a
            })
        }
        for (let i = grilleTmp.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [grilleTmp[i], grilleTmp[j]] = [grilleTmp[j], grilleTmp[i]];
        }

        for(let elem of grilleTmp) {
            this.grille.push({
                id:id,
                id_card:elem.id_card,
                text:elem.text,
                img:elem.img,
                show:false,
                find:false
            })
            id++;
        }

        this.flip = -1;
        this.end = false;

        this.score = 15;

        
        //console.log('Grille : ', this.grille);
    }
   
}

Game.prototype.grilleToSend = function() {
    let grilleToReturn = [];
    for(let elem of this.grille) {
        let obj = {
            id:elem.id
        }
        if(elem.show || elem.find) {
            obj.text = elem.text;
            obj.img = elem.img
        }
        grilleToReturn.push(obj);
    }
    return grilleToReturn;
}

Game.prototype.setGrilleFont = function() {
    let grilleToReturn = [];
    for(let elem of this.grille) {
        let obj = {
            id:elem.id
        }
        grilleToReturn.push(obj);
    }
    return { grille:grilleToReturn, score:this.score};
}

Game.prototype.reveal = function(position){
    if(!this.end) {
        if(position < this.grille.length) {
            if(!this.grille[position].find) {
                if(this.flip == -1) {
                    this.flip = position;
                    this.checkEnd();
                    return {response:true, text:this.grille[position].text, img:this.grille[position].img, cards:[this.flip, -1], score:this.score, end:this.end};
                }
                if(this.flip > -1) {
                    return this.match(position)
                }
            }
            return {response:false, cards:[-1, -1], score:this.score, end:false};
        }
        return {response:false, cards:[-1, -1], end:false};
    }
    return {response:false, cards:[-1, -1], end:true};
}

Game.prototype.match=function(position){
    let valid = this.grille[position].id_card == this.grille[this.flip].id_card;
    if(valid) {
        this.grille[position].find = true;
        this.grille[this.flip].find = true;
        this.score += 10;
    }
    else {
        this.score -= 5;
    }
    const oldFlip = this.flip;
    this.flip = -1;
    this.checkEnd();
    return {response:valid, text:this.grille[position].text, img:this.grille[position].img, cards:[oldFlip, position], score:this.score, found:valid, end:this.end};
}

Game.prototype.checkEnd=function(){
    let checkEnd = this.grille.filter(elem =>  !elem.find )
    console.log(checkEnd)
    this.end = checkEnd.length === 0;
    return this.end;
}

module.exports = Game;