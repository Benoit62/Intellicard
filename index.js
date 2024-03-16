/* INCLUDE DES PACKAGES */
const mysql = require('mysql');
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');   
const saltRounds = 10;                          
const app = express();
const sanitizeHtml = require('sanitize-html');
const validator = require('validator');
const helmet = require('helmet')

const multer = require('multer');
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
	  cb(null, 'front/uploads/')
	},
	filename: function (req, file, cb) {
		cb(null, Date.now() + randTmp() + path.extname(file.originalname))
	}
})
const upload = multer({ //multer settings
    storage: storage,
    fileFilter: function (req, file, callback) {
        var ext = path.extname(file.originalname);
        if(ext !== '.png' && ext !== '.jpg' && ext !== '.gif' && ext !== '.jpeg' && ext !== '.svg') {
            return callback(new Error('Only images are allowed'))
        }
        callback(null, true)
    },
    /*limits:{
        fileSize: 1024 * 1024
    }*/
})
const uploadMix = multer({ //multer settings
    storage: storage,
    fileFilter: function (req, file, callback) {
        var ext = path.extname(file.originalname);
        if(ext !== '.png' && ext !== '.jpg' && ext !== '.gif' && ext !== '.jpeg' && ext !== '.svg' && ext !== '.pdf') {
            return callback(new Error('Only images or pdf are allowed'))
        }
        callback(null, true)
    },
})
const fs = require("fs");
const sharp = require("sharp");

const ejs = require('ejs');

const http = require('http').Server(app);
const io = require('socket.io')(http);

const Game = require('./back/Game');
/* FIN INCLUDE DES PACKAGES */


//Connexion à la BDD
const db = mysql.createConnection({
	host     : process.env.HOST,
	user     : process.env.USER,
	password : process.env.PASSWORD,
	database : process.env.DATABASE
});

//Test de la connexion à la BDD
db.connect((err) => {
	if (err) {
	  console.error('Erreur de connexion à la base de données :', err);
	  return;
	}
	console.log('Connecté à la base de données MySQL !');
});


//Setup des sessions express
app.use(session({
	secret: '1s3CRetBienG@rde',
	resave: true,
	saveUninitialized: true,
	rolling:true,
	cookie: {
		maxAge: 7 * 24 * 60 * 60 * 1000,
		secure: false
	}
}));


//Init of express, to point our assets
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/front/'));
app.use(helmet())
app.set('view engine', 'ejs');

// Détection de si nous sommes en production, pour sécuriser en https
if (app.get('env') === 'production') {
    app.set('trust proxy', 1) // trust first proxy
    session.cookie.secure = true // serve secure cookies
}


// Middleware de vérification de connexion
const requireLogin = (req, res, next) => {
	// Vérifier si l'utilisateur est connecté en vérifiant si la session contient les informations nécessaires
	if (!req.session.isLoggedIn) {
	  	return res.redirect('/login?origin='+req.url);
	}
	
	// Si l'utilisateur est connecté, passer au middleware suivant
	next();
};

// Middleware de vérification de non-connexion
const requireLogout = (req, res, next) => {
	if (req.session.isLoggedIn) {
	  	return res.redirect('/home');
	}
	
	next();
};

// Fonction de validation avancée des entrées utilisateur
function validateUserInput(input, inputType, required, noMaxSize) {
	// Vérification de la validité des données
	if ((!input || typeof input !== 'string') && required) {
	  return { valid: false, message: 'Entrée vide ou invalide' };
	}

	// Suppression des caractères spéciaux et balises HTML potentiellement dangereuses
	const sanitizedInput = sanitizeHtml(input).trim();

	if(sanitizedInput !== input){
		return { valid: false, message: 'Entrée invalide : '+input };
	}
  
	// Vérification de la longueur
	if (sanitizedInput.length > 100 && !noMaxSize) {
	  return { valid: false, message: 'Longueur de l\'entrée dépassée (100)' };
	}
  
	// Validation spécifique selon le type d'entrée
	switch (inputType) {
		case 'email':
			if (!validator.isEmail(sanitizedInput)) {
				return { valid: false, message: 'Invalid email' };
			}
			break;
		case 'password':
			// Vérification des caractères valides du mot de passe
			/*if (!/^[a-zA-Z0-9!@#$%^&*]+$/g.test(sanitizedInput)) {
				return { valid: false, message: 'Le mot de passe contient des caractères non valides' };
			}*/
			// Autres validations pour le mot de passe (longueur minimale, etc.)
			/*if (sanitizedInput.length < 8) {
				return { valid: false, message: 'Le mot de passe doit contenir au moins 8 caractères' };
			}*/
			break;
		case 'name':
			break;
		// Ajoutez d'autres cas pour les types d'entrée spécifiques que vous souhaitez valider
		// ...
		default:
			return { valid: false, message: 'Type d\'entrée non pris en charge' };
	}
  
	// Validation réussie
	return { valid: true, sanitizedInput };
}


app.get('/test', requireLogin, function(req,res){

	res.sendFile(path.join(__dirname + '/front/html/testimage.html'));
})

function randTmp(){
	code = '';
	var charTab = [
		'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
		'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
		'0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
	];
	for (let i = 0; i < 5; i++) {
		code += charTab[Math.floor(Math.random() * charTab.length)];
	}
	return code
}

//Ajout d'un parcours
app.post('/test_img', requireLogin, upload.any(), async (req, res) => {
	let imagesUploaded = [];
	console.log(req.body, req.files)
	// Accéder aux fichiers uploadés dans req.files
	// Traiter les fichiers un par un
	/*req.files.forEach(async (file) => {
		// Utiliser Sharp pour compresser les images
		await sharp(file.path)
		//.resize({ fit: 'inside', withoutEnlargement: true, width: 200, height: 200 })
		.toFormat('jpeg')
		.jpeg({ quality: 20 })
		.toBuffer()
		.then(compressedData => {
			// Vérifier la taille du fichier compressé
			if (compressedData.length > 500 * 1024) {
				// Gérer le cas où le fichier compressé dépasse la taille maximale autorisée
				console.log("not yo ??", compressedData.length, 500*1024)
			} else {
				// Enregistrer le fichier compressé sur le serveur
				// Gérer le fichier comme requis (par exemple, le sauvegarder dans une base de données, etc.)
				
				const destinationPath = 'uploads/'+Date.now()+'fichier.jpg';
				imagesUploaded.push(destinationPath)
				console.log(imagesUploaded)

				// Enregistrer le fichier compressé sur le serveur
				fs.writeFile(destinationPath, compressedData, (err) => {
					if (err) {
						// Gérer les erreurs lors de l'enregistrement du fichier
					} else {
						// Le fichier compressé a été enregistré avec succès sur le serveur
						// Vous pouvez effectuer d'autres opérations sur le fichier ici
						// Supprimez les fichiers téléchargés du système de fichiers
						fs.unlinkSync(file.path);
					}
				});
			}
		})
		.catch(error => {
			// Gérer les erreurs de compression ou de traitement des fichiers
		});
	});*/


	const files = req.files;

	// Compression des images
	const compressedImages = await Promise.all(
		files.map(async (file) => {
			const compressedImage = await sharp(file.path)
				.toFormat('jpeg')
				.jpeg({ quality: 20 })
				.toBuffer()

			return {
				originalName: file.originalname,
				buffer: compressedImage
			};
		})
	);

	const imagesWithinSizeLimit = compressedImages.filter((image) => image.buffer.length <= 500 * 1024);

	// Enregistrez les images dans la limite de taille
	imagesWithinSizeLimit.forEach(async (image) => {
		// Générez un nom de fichier unique, par exemple en utilisant un horodatage ou un identifiant unique
		const destinationPath = 'front/uploads/'+Date.now()+'-'+randTmp()+'-fichier.jpg';
		imagesUploaded.push(destinationPath);

		fs.writeFile(destinationPath, image.buffer, (err) => {
			if (err) {
				console.error('Erreur lors de l\'enregistrement de l\'image :', err);
				// Gérez l'erreur (par exemple, renvoyer une réponse d'erreur appropriée au client)
			} else {
				console.log('Image enregistrée avec succès :', destinationPath);
				// Effectuez d'autres actions si nécessaire (par exemple, stockez le chemin de l'image dans une base de données)
			}
		});
	});

	// Supprimez les fichiers téléchargés du système de fichiers
	files.forEach((file) => {
		fs.unlinkSync(file.path);
	});

	console.log(imagesUploaded)

	return res.status(200).json({ message: 'Contenu envoyé vers le serveur' });
});


//Modification de deck
app.get('/modify-deck/:value', requireLogin, (req, res) => {
	const id_deck = req.params.value;
	console.log("Accès au deck coté créateur : ", id_deck);
	const query='SELECT (SELECT COUNT(*) FROM deck WHERE id_deck = ? AND id_user = ?) AS creator_and_deck_exist'
	db.query(query, [id_deck, req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès au deck :', err);
			return res.redirect('/gestion');
		}

		if(rows[0].creator_and_deck_exist <= 0) {
			return res.redirect('/gestion');
		}


		let query = `SELECT deck.id_deck, deck.name, deck.code, deck.acces_type, deck.type, tag.tag, level.level
		FROM deck
		INNER JOIN tag ON deck.id_tag = tag.id_tag
		INNER JOIN level ON deck.id_level = level.id_level
		WHERE deck.id_deck = ?
		GROUP BY deck.id_deck, deck.name, tag.tag, level.level`;
		
		db.query(query, [id_deck], (err, deck) => {
			
			if (err) {
				console.error('Erreur lors de la récupération du deck :', err);
				return res.redirect('/gestion');
			}
			
			if(!deck || deck.length <= 0) {
				return res.redirect('/gestion');
			}
			
			let query2 = `SELECT card.id_card, question, answer, img_q, img_a
			FROM card
			WHERE card.id_deck = ?
			GROUP BY card.id_card`;
			
			db.query(query2, [id_deck], (err, cards) => {
				
				if (err) {
					console.error('Erreur lors de la récupération des cartes :', err);
					return res.redirect('/gestion');
				}

				if(!cards || cards.length <= 0) {
					//return res.redirect('/gestion');
				}
				
				let query4 = `SELECT COUNT(card.id_card) AS card_count, GROUP_CONCAT(card.id_card) AS all_card_ids, GROUP_CONCAT(card.question SEPARATOR "&") AS all_card_q, GROUP_CONCAT(card.answer SEPARATOR "&") AS all_card_r, GROUP_CONCAT(card.img_q SEPARATOR "&") AS all_card_img_q, GROUP_CONCAT(card.img_a SEPARATOR "&") AS all_card_img_r, step.id_step, title, type, content, step_order
				FROM step
				LEFT JOIN card ON (card.id_step = step.id_step AND card.id_deck = ?)
				WHERE step.id_deck = ?
				GROUP BY step.id_step
				ORDER BY id_step ASC`;
				db.query(query4, [id_deck, id_deck], (err, parcours) => {
					
					if (err) {
						console.error('Erreur lors de la récupération du parcours du deck :', err);
						return res.redirect('/gestion');
					}
			
					// Renvoyez la page HTML avec les valeurs de la base de données
					//res.render(path.join(__dirname + '/front/html/modify_deck'), { data:rows }); // 'page' est le nom de votre fichier de template EJS
					res.render(path.join(__dirname + '/front/html/modify_deck'), { deck:deck, cards:cards, parcours:parcours });
				});			
			});
		
		});
		
	});



	/*const id_deck = req.params.value;
	const query='SELECT GROUP_CONCAT(card.id_card SEPARATOR "&") AS all_card_id, GROUP_CONCAT(card.question SEPARATOR "&") AS all_card_q, GROUP_CONCAT(card.answer SEPARATOR "&") AS all_card_r, GROUP_CONCAT(card.img_q SEPARATOR "&") AS all_card_img_q, GROUP_CONCAT(card.img_a SEPARATOR "&") AS all_card_img_r, deck.id_deck, deck.name, deck.acces_type, tag.tag, level.level, tag.id_tag, level.id_level FROM deck INNER JOIN tag ON deck.id_tag = tag.id_tag INNER JOIN level ON deck.id_level = level.id_level LEFT JOIN card ON deck.id_deck = card.id_deck WHERE deck.id_deck = ? && deck.id_user = ? GROUP BY deck.id_deck, deck.name,  tag.tag, level.level'
	db.query(query, [id_deck, req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la récupération du deck et des cartes :', err);
			return res.redirect('/gestion');
		}
		
		if(rows.length > 0) {
		// Renvoyez la page HTML avec les valeurs de la base de données
			res.render(path.join(__dirname + '/front/html/modify_deck'), { data:rows }); // 'page' est le nom de votre fichier de template EJS
		}
		else {
			return res.redirect('/gestion');
		}
	});*/
});


//Accès à un deck
app.get('/deck/:value', requireLogin, (req, res) => {

	const id_deck = req.params.value;
	console.log("Accès au deck : ", id_deck);
	const query='SELECT (SELECT COUNT(*) FROM consult WHERE id_deck = ? AND id_user = ? AND archive = 0) AS consult_exist, (SELECT COUNT(*) FROM deck WHERE id_deck = ?) AS deck_exist, (SELECT id_step FROM step WHERE id_deck = ? && step_order IN (SELECT step FROM consult WHERE id_deck = ? AND id_user = ?)) AS id_step'
	db.query(query, [id_deck, req.session.userId, id_deck, id_deck, id_deck, req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification que l\'utilisateur utilise le deck:', err);
			return res.redirect('/decks');
		}

		if(rows[0].consult_exist <= 0 || rows[0].deck_exist <= 0) {
			return res.redirect('/decks');
		}

		const id_step = rows[0].id_step || 0;


		let query = `SELECT CAST(AVG(cards_score.score) AS INT) AS average_score, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.acces_type, deck.type, DATE_FORMAT(last_modification, "%d/%m/%Y") AS last_modification, tag.tag, level.level, consult.nb_card_by_train, consult.reverse_side
		FROM deck
		INNER JOIN tag ON deck.id_tag = tag.id_tag
		INNER JOIN level ON deck.id_level = level.id_level
		INNER JOIN consult ON deck.id_deck = consult.id_deck AND consult.id_user = ?
		LEFT JOIN cards_score ON (deck.id_deck = cards_score.id_deck AND cards_score.id_user = ? AND cards_score.score > 0)
		WHERE deck.id_deck = ?
		GROUP BY deck.id_deck, deck.name, deck.up_vote, deck.down_vote, tag.tag, level.level`;
		
		db.query(query, [req.session.userId, req.session.userId, id_deck], (err, deck) => {
			
			if (err) {
				console.error('Erreur lors de la récupération du deck :', err);
				return res.redirect('/decks');
			}
			
			if(!deck || deck.length <= 0) {
				return res.redirect('/decks');
			}
			
			let query2 = `SELECT card.id_card, question, answer, img_q, img_a, score
			FROM card
			INNER JOIN cards_score ON card.id_card = cards_score.id_card AND cards_score.id_user = ?
			WHERE card.id_deck = ? && card.id_step <= ?`;
			
			db.query(query2, [req.session.userId, id_deck, id_step], (err, cards) => {
				
				if (err) {
					console.error('Erreur lors de la récupération des cartes du deck :', err);
					return res.redirect('/decks');
				}
				
				if(!cards || cards.length <= 0) {
					//return res.redirect('/decks');
				}


				//Récupération des stats : nombre de cartes révisées/jour, nombre de cartes révisées au total, nombre de sessions au total, dernière révision
				let query3 = `SELECT 
				(SELECT COUNT(id_train) FROM train WHERE id_user = ? && id_deck = ? && date = DATE_FORMAT(NOW(), "%Y-%m-%d") GROUP by id_user, date) as nb_card_this_day,
				(SELECT COUNT(id_train) FROM train WHERE id_user = ? && id_deck = ? GROUP by id_user) as nb_card_all_time,
				(SELECT COUNT(DISTINCT session) FROM train WHERE id_user = ? && id_deck = ? GROUP by id_user) as nb_session,
				(SELECT DATE_FORMAT(date, "%d/%m/%Y") FROM train WHERE id_user = ? && id_deck = ? ORDER BY id_train DESC LIMIT 1) as last_train,
				(SELECT COUNT(DISTINCT id_card) FROM train WHERE id_user = ? && id_deck = ? GROUP by id_user) as nb_carte_viewed,
				(SELECT COUNT(id_card) FROM card WHERE id_deck = ? GROUP by id_deck) as nb_carte_total_in_deck`;
				db.query(query3, [req.session.userId, id_deck, req.session.userId, id_deck, req.session.userId, id_deck, req.session.userId, id_deck, req.session.userId, id_deck, id_deck], (err, resultStats) => {
					if (err) {
						console.error('Erreur lors de la récupération des stats :', err);
						return res.redirect('/decks');
					}
					let stats = {
						nb_card_this_day:resultStats[0].nb_card_this_day,
						nb_card_all_time:resultStats[0].nb_card_all_time,
						nb_session:resultStats[0].nb_session,
						last_train:resultStats[0].last_train,
						nb_carte_viewed:resultStats[0].nb_carte_viewed,
						nb_carte_total_in_deck:resultStats[0].nb_carte_total_in_deck,
					}

					
					let query4 = `SELECT step.id_step, title, type, step_order
					FROM step
					WHERE step.id_deck = ?
					ORDER BY id_step ASC`;
					
					db.query(query4, [id_deck], (err, parcours) => {
						
						if (err) {
							console.error('Erreur lors de la récupération du parcours du deck :', err);
							return res.redirect('/decks');
						}
				
						// Renvoyez la page HTML avec les valeurs de la base de données
						//res.render(path.join(__dirname + '/front/html/modify_deck'), { data:rows }); // 'page' est le nom de votre fichier de template EJS
						res.render(path.join(__dirname + '/front/html/deck'), { deck:deck, cards:cards, stats:stats, unlock:parcours.filter(elem => elem.id_step <= id_step), lock:parcours.filter(elem => elem.id_step > id_step) });
					});
				});
			
			});
		
		});
		
	});
});

//Accès à un parcours
app.get('/parcours/:value', requireLogin, (req, res) => {

	const id_deck = req.params.value;
	console.log("Accès au parcours : ", id_deck);
	const query='SELECT (SELECT COUNT(*) FROM consult WHERE id_deck = ? AND id_user = ?) AS consult_exist, (SELECT COUNT(*) FROM deck WHERE id_deck = ?) AS deck_exist, (SELECT step FROM consult WHERE id_deck = ? AND id_user = ?) AS step'
	db.query(query, [id_deck, req.session.userId, id_deck, id_deck, req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification que l\'utilisateur utilise le deck:', err);
			return res.redirect('/decks');
		}

		if(rows[0].consult_exist <= 0 || rows[0].deck_exist <= 0) {
			return res.redirect('/decks');
		}


		let query = `SELECT deck.id_deck, deck.name, deck.description
		FROM deck
		WHERE deck.id_deck = ?`;
		
		db.query(query, [id_deck], (err, deck) => {
			
			if (err) {
				console.error('Erreur lors de la récupération du deck :', err);
				return res.redirect('/decks');
			}
			
			if(!deck || deck.length <= 0) {
				return res.redirect('/decks');
			}

			let query4 = `SELECT COUNT(card.id_card) AS card_count, GROUP_CONCAT(card.id_card) AS all_card_ids, GROUP_CONCAT(card.question SEPARATOR "&") AS all_card_q, GROUP_CONCAT(card.answer SEPARATOR "&") AS all_card_r, GROUP_CONCAT(card.img_q SEPARATOR "&") AS all_card_img_q, GROUP_CONCAT(card.img_a SEPARATOR "&") AS all_card_img_r, step.id_step, title, type, content, step_order
			FROM step
			LEFT JOIN card ON (card.id_step = step.id_step AND card.id_deck = ?)
			WHERE step.id_deck = ?
			GROUP BY step.id_step
			ORDER BY id_step ASC`;
			
			db.query(query4, [id_deck, id_deck], (err, parcours) => {
				
				if (err) {
					console.error('Erreur lors de la récupération du parcours du deck :', err);
					return res.redirect('/decks');
				}
		
				// Renvoyez la page HTML avec les valeurs de la base de données
				//res.render(path.join(__dirname + '/front/html/modify_deck'), { data:rows }); // 'page' est le nom de votre fichier de template EJS
				res.render(path.join(__dirname + '/front/html/parcours'), { deck:deck, unlock:parcours.filter(elem => elem.step_order <= rows[0].step), lock:parcours.filter(elem => elem.step_order > rows[0].step) });
			});
		
		});
		
	});
});


//Accès à un deck créé
app.get('/my-deck/:value', requireLogin, (req, res) => {

	const id_deck = req.params.value;
	console.log("Accès au deck coté créateur : ", id_deck);
	const query='SELECT (SELECT COUNT(*) FROM deck WHERE id_deck = ? AND id_user = ?) AS creator_and_deck_exist'
	db.query(query, [id_deck, req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès au deck :', err);
			return res.redirect('/gestion');
		}
		console.log(rows);

		if(rows[0].creator_and_deck_exist <= 0) {
			return res.redirect('/gestion');
		}


		let query = `SELECT CAST(AVG(cards_score.score) AS INT) AS average_score, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.code, deck.acces_type, deck.type, DATE_FORMAT(last_modification, "%d/%m/%Y") AS last_modification, tag.tag, level.level
		FROM deck
		INNER JOIN tag ON deck.id_tag = tag.id_tag
		INNER JOIN level ON deck.id_level = level.id_level
		LEFT JOIN cards_score ON (deck.id_deck = cards_score.id_deck AND cards_score.score > 0)
		WHERE deck.id_deck = ?
		GROUP BY deck.id_deck, deck.name, deck.up_vote, deck.down_vote, tag.tag, level.level`;
		
		db.query(query, [id_deck], (err, deck) => {
			
			if (err) {
				console.error('Erreur lors de la récupération du deck :', err);
				return res.redirect('/gestion');
			}
			console.log(deck);
			
			if(!deck || deck.length <= 0) {
				return res.redirect('/gestion');
			}
			
			let query2 = `SELECT card.id_card, question, answer, img_q, img_a, CAST(AVG(cards_score.score) AS INT) AS average_score_by_card
			FROM card
			LEFT JOIN cards_score ON card.id_card = cards_score.id_card
			WHERE card.id_deck = ?
			GROUP BY card.id_card`;
			
			db.query(query2, [id_deck], (err, cards) => {
				
				if (err) {
					console.error('Erreur lors de la récupération des cartes :', err);
					return res.redirect('/gestion');
				}
				
				console.log(cards);

				if(!cards || cards.length <= 0) {
					//return res.redirect('/gestion');
				}


				//Récupération des stats : nombre de cartes révisées/jour, nombre de cartes révisées au total, nombre de sessions au total, dernière révision
				let query3 = `SELECT 
				(SELECT COUNT(id_train) FROM train WHERE id_deck = ? && date = DATE_FORMAT(NOW(), "%Y-%m-%d") GROUP by id_deck, date) as nb_card_this_day,
				(SELECT COUNT(id_train) FROM train WHERE id_deck = ? GROUP by id_deck) as nb_card_all_time,
				(SELECT COUNT(DISTINCT session) FROM train WHERE id_deck = ? GROUP by id_deck) as nb_session,
				(SELECT DATE_FORMAT(date, "%d/%m/%Y") FROM train WHERE id_deck = ? ORDER BY id_train DESC LIMIT 1) as last_train,
				
				(SELECT COUNT(DISTINCT consult.id_user) FROM consult WHERE id_deck = ?) as nb_users_consulting`;
				db.query(query3, [id_deck, id_deck, id_deck, id_deck, id_deck], (err, resultStats) => {
					if (err) {
						console.error('Erreur lors de la récupération des stats :', err);
						return res.redirect('/gestion');
					}
					let stats = {
						nb_card_this_day:resultStats[0].nb_card_this_day,
						nb_card_all_time:resultStats[0].nb_card_all_time,
						nb_session:resultStats[0].nb_session,
						last_train:resultStats[0].last_train,
						nb_users_consulting:resultStats[0].nb_users_consulting
					}
				
					/*let query4 = `SELECT step.id_step, title, type, content
					FROM step
					WHERE step.id_deck = ?
					ORDER BY id_step ASC`;*/
					let query4 = `SELECT COUNT(card.id_card) AS card_count, GROUP_CONCAT(card.id_card) AS all_card_ids, GROUP_CONCAT(card.question SEPARATOR "&") AS all_card_q, GROUP_CONCAT(card.answer SEPARATOR "&") AS all_card_r, GROUP_CONCAT(card.img_q SEPARATOR "&") AS all_card_img_q, GROUP_CONCAT(card.img_a SEPARATOR "&") AS all_card_img_r, step.id_step, title, type, content, step_order
					FROM step
					LEFT JOIN card ON (card.id_step = step.id_step AND card.id_deck = ?)
					WHERE step.id_deck = ?
					GROUP BY step.id_step
					ORDER BY id_step ASC`;
					db.query(query4, [id_deck, id_deck], (err, parcours) => {
						
						if (err) {
							console.error('Erreur lors de la récupération du parcours du deck :', err);
							return res.redirect('/gestion');
						}
				
						// Renvoyez la page HTML avec les valeurs de la base de données
						//res.render(path.join(__dirname + '/front/html/modify_deck'), { data:rows }); // 'page' est le nom de votre fichier de template EJS
						res.render(path.join(__dirname + '/front/html/my_deck'), { deck:deck, cards:cards, stats:stats, parcours:parcours });
					});
				});
			
			});
		
		});
		
	});
});

//Accès à un entrainement
app.get('/train/:value', requireLogin, (req, res) => {

	const id_deck = req.params.value;
	console.log("Accès au train du deck : ", id_deck);
	const query='SELECT (SELECT COUNT(*) FROM consult WHERE id_deck = ? AND id_user = ?) AS consult_exist, (SELECT COUNT(*) FROM deck WHERE id_deck = ?) AS deck_exist, (SELECT nb_card_by_train FROM consult WHERE id_deck = ? AND id_user = ?) AS nb_cards_to_send, (SELECT reverse_side FROM consult WHERE id_deck = ? AND id_user = ?) AS reverse, (SELECT id_step FROM step WHERE id_deck = ? && step_order IN (SELECT step FROM consult WHERE id_deck = ? AND id_user = ?)) AS id_step'
	db.query(query, [id_deck, req.session.userId, id_deck, id_deck, req.session.userId, id_deck, req.session.userId, id_deck, id_deck, req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès au deck :', err);
			return res.redirect('/deck/'+id_deck);
		}

		if(rows[0].consult_exist <= 0 || rows[0].deck_exist <= 0) {
			return res.redirect('/deck/'+id_deck);
		}

		const id_step = rows[0].id_step || 0;

		// On envoie seulement les cartes débloquées
		const selectQuery = 'SELECT card.id_deck, card.id_card, card.question, card.answer, card.img_q, card.img_a FROM card INNER JOIN cards_score ON (card.id_card = cards_score.id_card AND cards_score.id_user = ?) WHERE card.id_deck = ? && card.id_step <= ? ORDER BY cards_score.score ASC, RAND() LIMIT ?';
		
		db.query(selectQuery, [req.session.userId, id_deck, id_step, rows[0].nb_cards_to_send], (err, results) => {
			if (err) {
				console.error('Erreur lors de la récupération des cartes :', err);
				return res.redirect('/deck/'+id_deck);
			}

			if(!results || results.length <= 0) {
				return res.redirect('/deck/'+id_deck);
			}

			const now = new Date();

			const randSession =
			now.getFullYear().toString() +
			  ("0" + (now.getMonth() + 1)).slice(-2) +
			  ("0" + now.getDate()).slice(-2) +
			  ("0" + now.getHours()).slice(-2) +
			  ("0" + now.getMinutes()).slice(-2) +
			  ("0" + now.getSeconds()).slice(-2);

			req.session.idTrain = randSession;

			if(rows[0].reverse) {
				results.forEach(elem => {
					let tmp = elem.question;
					elem.question = elem.answer
					elem.answer = tmp
				})
			}
			
			res.render(path.join(__dirname + '/front/html/train'), { data:results, reverse:rows[0].reverse });
		});
		
	});
})

//Page d'accueil
app.get('/home', requireLogin, function(req, res) {

	const queryFisrt = `SELECT DISTINCT id_deck FROM train WHERE train.id_user = ? ORDER BY id_train DESC LIMIT 2`;
	
	db.query(queryFisrt, [req.session.userId], (err, ids) => {
		if (err) {
			console.error('Erreur lors de la récupération des derniers entrainements :', err);
			return res.redirect('/error');
		}

		if(!ids || ids.length <= 0) {
			return res.render(path.join(__dirname + '/front/html/home'), { deck:[], parcours:[], stats:{last_train:''}, admin:req.session.admin });
		}

		let lastDecks = [];
		ids.forEach(element=>{
			lastDecks.push(element.id_deck);
		})
			
		const query=`SELECT CAST(AVG(cards_score.score) AS INT) AS average_score, COUNT(DISTINCT card.id_card) AS card_count, COUNT(DISTINCT step.id_step) AS step_count, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.acces_type, deck.type, tag.tag, level.level, user.firstname, user.surname FROM deck INNER JOIN tag ON deck.id_tag = tag.id_tag INNER JOIN level ON deck.id_level = level.id_level INNER JOIN user ON deck.id_user = user.id_user LEFT JOIN card ON deck.id_deck = card.id_deck LEFT JOIN step ON deck.id_deck = step.id_deck LEFT JOIN cards_score ON (card.id_card = cards_score.id_card AND cards_score.score > 0 AND cards_score.id_user = ?) WHERE deck.id_deck IN (?) GROUP BY deck.id_deck`
		db.query(query, [req.session.userId, lastDecks], (err, rows) => {
			if (err) {
				console.error('Erreur lors de la récupération du deck :', err);
				return res.redirect('/error');
			}


			//Récupération des stats : nombre de cartes révisées/jour, nombre de cartes révisées au total, nombre de sessions au total, dernière révision
			let query3 = `SELECT 
			(SELECT DATE_FORMAT(date, "%d/%m/%Y") FROM train WHERE id_user = ? ORDER BY id_train DESC LIMIT 1) as last_train,
			(SELECT COUNT(id_train) FROM train WHERE id_user = ? && date > DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY id_user) as card_this_week,
			(SELECT COUNT(DISTINCT session) FROM train WHERE id_user = ? && date > DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY id_user) as session_this_week`;
			db.query(query3, [req.session.userId, req.session.userId, req.session.userId], (err, resultStats) => {
				if (err) {
					console.error('Erreur lors de la récupération des stats :', err);
					return res.redirect('/error');
				}
				let stats = {
					last_train:resultStats[0].last_train,
					card_this_week:resultStats[0].card_this_week,
					session_this_week:resultStats[0].session_this_week
				}

				if(!rows || rows.length <= 0) {
					return res.render(path.join(__dirname + '/front/html/home'), { deck:[], parcours:[], stats:stats, admin:req.session.admin });
				}
					
				return res.render(path.join(__dirname + '/front/html/home'), { deck:rows.filter(elem => elem.type == "DECK"), parcours:rows.filter(elem => elem.type == "PARCOURS"), stats:stats, admin:req.session.admin });
			});
		});
	});
});


//Page admin
app.get('/admin', requireLogin, function(req, res) {

	if(!req.session.admin) {
		return res.redirect('/home');
	}

	const suppQuery = 'SELECT CAST(AVG(cards_score.score) AS INT) AS average_score, COUNT(DISTINCT card.id_card) AS card_count, COUNT(DISTINCT step.id_step) AS step_count, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.acces_type, deck.type, tag.tag, level.level, user.firstname, user.surname, reason FROM supp INNER JOIN deck ON deck.id_deck = supp.id_deck INNER JOIN tag ON deck.id_tag = tag.id_tag INNER JOIN level ON deck.id_level = level.id_level INNER JOIN user ON deck.id_user = user.id_user LEFT JOIN card ON deck.id_deck = card.id_deck LEFT JOIN step ON deck.id_deck = step.id_deck LEFT JOIN cards_score ON (card.id_card = cards_score.id_card AND cards_score.score > 0 AND cards_score.id_user = ?) GROUP BY deck.id_deck ORDER BY name ASC';
	db.query(suppQuery, [req.session.userId, req.session.userId], (err, supp) => {
		if (err) {
			console.error('Erreur lors de la récupération des demandes de suppression :', err);
			return res.redirect('/home');
		}

		const tagQuery = 'SELECT * FROM tag WHERE id_tag > 0';
		db.query(tagQuery, (err, tag) => {
			if (err) {
				console.error('Erreur lors de la récupération des tags :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			const levelQuery = 'SELECT * FROM level WHERE id_level > 0';
			db.query(levelQuery, (err, level) => {
				if (err) {
					console.error('Erreur lors de la récupération des levels :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
				}

				return res.render(path.join(__dirname + '/front/html/admin'), { supp:supp, tag:tag, level:level });
			});
		});

		
	});

});

//Page du profil
app.get('/profil', requireLogin, function(req, res) {
	const queryFisrt = `SELECT
	(SELECT DATE_FORMAT(date, "%d/%m/%Y") FROM train WHERE id_user = ? ORDER BY id_train DESC LIMIT 1) as last_train,
	(SELECT COUNT(id_train) FROM train WHERE id_user = ? AND date = CURDATE()) as nb_trained_this_day,
	(SELECT COUNT(id_train) FROM train WHERE id_user = ?) as nb_trained_all_time,
	(SELECT COUNT(id_deck) FROM deck WHERE id_user = ?) as nb_created,
	(SELECT COUNT(id_consult) FROM consult WHERE id_deck IN (SELECT id_deck FROM deck WHERE id_user = ?)) as nb_deck_used,
	(SELECT COUNT(DISTINCT consult.id_user) FROM consult WHERE id_deck IN (SELECT id_deck FROM deck WHERE id_user = ?)) as nb_users_consulting,
	COUNT(id_consult) as nb_deck_unlocked,
	firstname, surname, email, nb_connexion 
	FROM user 
	LEFT JOIN consult ON consult.id_user = user.id_user
	WHERE user.id_user = ?`;
	
	db.query(queryFisrt, [req.session.userId, req.session.userId, req.session.userId, req.session.userId, req.session.userId, req.session.userId, req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la récupération des infos utilisateurs :', err);
			return res.redirect('/home');
		}

		if(!rows || rows.length <= 0) {
			return res.redirect('/home');
		}

		const querySecond = `SELECT
		(SELECT COUNT(id_train) FROM train WHERE id_user = ? && date = DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY date) as card_by_day_1,
		(SELECT COUNT(id_train) FROM train WHERE id_user = ? && date = DATE_SUB(CURDATE(), INTERVAL 5 DAY) GROUP BY date) as card_by_day_2,
		(SELECT COUNT(id_train) FROM train WHERE id_user = ? && date = DATE_SUB(CURDATE(), INTERVAL 4 DAY) GROUP BY date) as card_by_day_3,
		(SELECT COUNT(id_train) FROM train WHERE id_user = ? && date = DATE_SUB(CURDATE(), INTERVAL 3 DAY) GROUP BY date) as card_by_day_4,
		(SELECT COUNT(id_train) FROM train WHERE id_user = ? && date = DATE_SUB(CURDATE(), INTERVAL 2 DAY) GROUP BY date) as card_by_day_5,
		(SELECT COUNT(id_train) FROM train WHERE id_user = ? && date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) GROUP BY date) as card_by_day_6,
		(SELECT COUNT(id_train) FROM train WHERE id_user = ? && date = DATE_SUB(CURDATE(), INTERVAL 0 DAY) GROUP BY date) as card_by_day_7
		`;
		db.query(querySecond, [req.session.userId, req.session.userId, req.session.userId, req.session.userId, req.session.userId, req.session.userId, req.session.userId], (err, cartes) => {
			if (err) {
				console.error('Erreur lors de la récupération des stats :', err);
				return res.redirect('/home');
			}

			const queryThird = `SELECT 
			(SELECT DAYNAME(DATE_SUB(CURDATE(), INTERVAL 6 DAY))) as day_1,
			(SELECT DAYNAME(DATE_SUB(CURDATE(), INTERVAL 5 DAY))) as day_2,
			(SELECT DAYNAME(DATE_SUB(CURDATE(), INTERVAL 4 DAY))) as day_3,
			(SELECT DAYNAME(DATE_SUB(CURDATE(), INTERVAL 3 DAY))) as day_4,
			(SELECT DAYNAME(DATE_SUB(CURDATE(), INTERVAL 2 DAY))) as day_5,
			(SELECT DAYNAME(DATE_SUB(CURDATE(), INTERVAL 1 DAY))) as day_6,
			(SELECT DAYNAME(CURDATE())) as day_7
			`;
			db.query(queryThird, [], (err, days) => {
				if (err) {
					console.error('Erreur lors de la récupération des deuxièmes stats :', err);
					return res.redirect('/home');
				}

				res.render(path.join(__dirname + '/front/html/profil'), { rows:rows, cartes:cartes, days:days });
			});
		});
	});
});



app.get('/memory', requireLogin , function(req,res){
	const query = 'SELECT CAST(AVG(cards_score.score) AS INT) AS average_score, COUNT(card.id_card) AS card_count, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.acces_type, tag.tag, level.level, user.firstname, user.surname FROM consult INNER JOIN deck ON deck.id_deck = consult.id_deck INNER JOIN tag ON deck.id_tag = tag.id_tag INNER JOIN level ON deck.id_level = level.id_level INNER JOIN user ON deck.id_user = user.id_user LEFT JOIN card ON deck.id_deck = card.id_deck LEFT JOIN cards_score ON (card.id_card = cards_score.id_card AND cards_score.score > 0 AND cards_score.id_user = ?) WHERE consult.id_user = ? GROUP BY deck.id_deck ORDER BY name ASC';
	db.query(query, [req.session.userId, req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la récupération du deck :', err);
			return res.redirect('/hub');
		}

		if(!rows || rows.length <= 0) {
			return res.render(path.join(__dirname + '/front/html/memory_hub'), { rows:[] });
		}
		const rowsToSend = rows.filter(elem => elem.card_count >= 6);
		if(rowsToSend.length == 0) {
			return res.redirect('/hub');
		}
		return res.render(path.join(__dirname + '/front/html/memory_hub'), { rows:rowsToSend });
	});
})


// Créer un dictionnaire pour stocker la partie de chaque session 
const tabGames = new Map();

//Accès à un entrainement
app.get('/memory/:value', requireLogin, (req, res) => {

	const id_deck = req.params.value;
	console.log("Accès au memory du deck : ", id_deck);

	if(id_deck === "shuffle") {
		const query='SELECT id_deck FROM consult WHERE id_user = ?'
		db.query(query, [req.session.userId], (err, decks) => {
			if (err) {
				console.error('Erreur lors de la vérification de l\'accès au deck :', err);
				return res.redirect('/hub');
			}

			if(!decks || decks.length <= 0) {
				return res.redirect('/hub');
			}

			let decks_consult = [];
			for(let elem of decks) {
				decks_consult.push(elem.id_deck)
			}

			const selectQuery = 'SELECT card.id_deck, card.id_card, card.question, card.answer, card.img_q, card.img_a FROM card WHERE card.id_deck IN (?) ORDER BY RAND() LIMIT 6';
			
			db.query(selectQuery, [decks_consult], (err, results) => {
				if (err) {
					console.error('Erreur lors de la récupération des cartes :', err);
					return res.redirect('/hub');
				}

				tabGames.set(req.session.userId, new Game(results));
				
				const gameToReturn = tabGames.get(req.session.userId).setGrilleFont()

				const now = new Date();

				const randSession =
				now.getFullYear().toString() +
				("0" + (now.getMonth() + 1)).slice(-2) +
				("0" + now.getDate()).slice(-2) +
				("0" + now.getHours()).slice(-2) +
				("0" + now.getMinutes()).slice(-2) +
				("0" + now.getSeconds()).slice(-2);

				req.session.idTrain = randSession;
				//console.log(req.session.idTrain)
				
				res.render(path.join(__dirname + '/front/html/game'), { game:gameToReturn });
			});
			
		});
	}
	else {

		const query='SELECT (SELECT COUNT(*) FROM consult WHERE id_deck = ? AND id_user = ?) AS consult_exist, (SELECT COUNT(*) FROM deck WHERE id_deck = ?) AS deck_exist'
		db.query(query, [id_deck, req.session.userId, id_deck], (err, rows) => {
			if (err) {
				console.error('Erreur lors de la vérification d\'accès au deck:', err);
				return res.redirect('/hub');
			}

			if(rows[0].consult_exist <= 0 || rows[0].deck_exist <= 0) {
				return res.redirect('/hub');
			}

			const selectQuery = 'SELECT card.id_deck, card.id_card, card.question, card.answer, card.img_q, card.img_a FROM card WHERE card.id_deck = ? ORDER BY RAND() LIMIT 6';
			
			db.query(selectQuery, [id_deck], (err, results) => {
				if (err) {
					console.error('Erreur lors de la récupération des cartes :', err);
					return res.redirect('/hub');
				}

				tabGames.set(req.session.userId, new Game(results));
				
				const gameToReturn = tabGames.get(req.session.userId).setGrilleFont()

				const now = new Date();

				const randSession =
				now.getFullYear().toString() +
				("0" + (now.getMonth() + 1)).slice(-2) +
				("0" + now.getDate()).slice(-2) +
				("0" + now.getHours()).slice(-2) +
				("0" + now.getMinutes()).slice(-2) +
				("0" + now.getSeconds()).slice(-2);

				req.session.idTrain = randSession;
				
				res.render(path.join(__dirname + '/front/html/game'), { game:gameToReturn });
			});
			
		});
	}
})


app.post('/reveal_card', requireLogin, (req, res) => {

	const { position } = req.body;
	
	const verif_position = validateUserInput(position, 'name', false);
	if(!verif_position.valid) {
		return res.status(401).json({ message: verif_position.message });
	}
	let valid_position = verif_position.sanitizedInput;

	if(tabGames.get(req.session.userId)) {

		const resultGame = tabGames.get(req.session.userId).reveal(valid_position);

		return res.status(201).json({ game:resultGame });
	}
})





/* LISTE DES PAGES */
app.get('/', function(request, response) {
	response.sendFile(path.join(__dirname + '/front/html/index.html'));
});

app.get('/index', function(request, response) {
	response.sendFile(path.join(__dirname + '/front/html/index.html'));
});

app.get('/appmobile', function(request, response) {
	response.sendFile(path.join(__dirname + '/front/html/appMobile.html'));
});

app.get('/login', requireLogout, function(req, res){
	res.sendFile(path.join(__dirname + '/front/html/login.html'));
});

app.get('/register', requireLogout, function(req, res){
	res.sendFile(path.join(__dirname + '/front/html/register.html'));
});
app.get('/search', requireLogin, function(req, res) {
	res.sendFile(path.join(__dirname + '/front/html/search.html'));
});

app.get('/decks', requireLogin, function(req, res) {

	const checkUserQuery = 'SELECT CAST(AVG(cards_score.score) AS INT) AS average_score, COUNT(DISTINCT card.id_card) AS card_count, COUNT(DISTINCT step.id_step) AS step_count, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.acces_type, deck.type, tag.tag, level.level, user.firstname, user.surname, consult.archive FROM consult INNER JOIN deck ON deck.id_deck = consult.id_deck INNER JOIN tag ON deck.id_tag = tag.id_tag INNER JOIN level ON deck.id_level = level.id_level INNER JOIN user ON deck.id_user = user.id_user LEFT JOIN card ON deck.id_deck = card.id_deck LEFT JOIN step ON deck.id_deck = step.id_deck LEFT JOIN cards_score ON (card.id_card = cards_score.id_card AND cards_score.score > 0 AND cards_score.id_user = ?) WHERE consult.id_user = ? GROUP BY deck.id_deck ORDER BY name ASC';
	db.query(checkUserQuery, [req.session.userId, req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la récupération des decks :', err);
			return res.redirect('/home');
		}

		if(!rows || rows.length <= 0) {
			return res.render(path.join(__dirname + '/front/html/decks_page'), { deck:[], parcours:[], archives:[] });
		}
			
		return res.render(path.join(__dirname + '/front/html/decks_page'), { deck:rows.filter(elem => elem.type == "DECK" && elem.archive == 0), parcours:rows.filter(elem => elem.type == "PARCOURS" && elem.archive == 0), archives:rows.filter(elem => elem.archive == 1) });
	});
});

app.get('/gestion', requireLogin, function(req, res) {

	const checkUserQuery = 'SELECT CAST(AVG(cards_score.score) AS INT) AS average_score, COUNT(DISTINCT card.id_card) AS card_count, COUNT(DISTINCT step.id_step) AS step_count, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.acces_type, deck.type, tag.tag, level.level FROM deck INNER JOIN tag ON deck.id_tag = tag.id_tag INNER JOIN level ON deck.id_level = level.id_level LEFT JOIN card ON deck.id_deck = card.id_deck LEFT JOIN step ON deck.id_deck = step.id_deck LEFT JOIN cards_score ON (card.id_card = cards_score.id_card AND cards_score.score > 0) WHERE deck.id_user = ? GROUP BY deck.id_deck ORDER BY name ASC';
	db.query(checkUserQuery, [req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la récupération des decks :', err);
			return res.redirect('/home');
		}

		if(!rows || rows.length <= 0) {
			return res.render(path.join(__dirname + '/front/html/gestion'), { deck:[], parcours:[] });
		}
			
		return res.render(path.join(__dirname + '/front/html/gestion'), { deck:rows.filter(elem => elem.type == "DECK"), parcours:rows.filter(elem => elem.type == "PARCOURS") });
	});
});


app.get('/add-deck', requireLogin, function(req, res) {
	res.sendFile(path.join(__dirname + '/front/html/add_deck.html'));
});

app.get('/add-parcours', requireLogin, function(req, res) {
	res.sendFile(path.join(__dirname + '/front/html/add_parcours.html'));
});
app.get('/gestion', requireLogin, function(req, res) {
	res.sendFile(path.join(__dirname + '/front/html/gestion.html'));

});
app.get('/parcours', requireLogin, function(req, res) {
	res.sendFile(path.join(__dirname + '/front/html/parcours.html'));
});
app.get('/jeu', requireLogin , function(req,res){

	res.sendFile(path.join(__dirname + '/front/html/jeu.html'));
})
app.get('/hub', requireLogin , function(req,res){

	res.sendFile(path.join(__dirname + '/front/html/hub.html'));
})
// Route de déconnexion
app.get('/logout', function(req, res) {
	// Détruire la session et rediriger vers la page de connexion
	req.session.destroy();
	return res.redirect('/login');
});

//Page 404 (à laisser à la fin !!!)
app.get('*', function (req, res) {
    res.sendFile(__dirname + '/front/html/404.html');
});
/* FIN LISTE DES PAGES */


// Inscription
app.post('/reg', requireLogout, async (req, res) => {
    const { firstname, surname, password, confirm_password, email } = req.body;

	// Validation des entrées utilisateur
	const verif_firstname = validateUserInput(firstname, 'name', true);
	if(!verif_firstname.valid) {
		return res.status(401).json({ message: verif_firstname.message });
	}
	const valid_firstname = verif_firstname.sanitizedInput;
	
	const verif_surname = validateUserInput(surname, 'name', true);
	if(!verif_surname.valid) {
		return res.status(401).json({ message: verif_surname.message });
	}
	const valid_surname = verif_surname.sanitizedInput;
	
	const verif_password = validateUserInput(password, 'password', true);
	if(!verif_password.valid) {
		return res.status(401).json({ message: verif_password.message });
	}
	const valid_password = verif_password.sanitizedInput;

	const verif_confirm_password = validateUserInput(confirm_password, 'password', true);
	if(!verif_confirm_password.valid) {
		return res.status(401).json({ message: verif_confirm_password.message });
	}
	const valid_confirm_password = verif_confirm_password.sanitizedInput;

	const verif_email = validateUserInput(email, 'email', true);
	if(!verif_email.valid) {
		return res.status(401).json({ message: verif_email.message });
	}
	const valid_email = verif_email.sanitizedInput;

	if(valid_password == valid_confirm_password){

		// Vérifier si l'utilisateur existe déjà dans la base de données
		const checkUserQuery = 'SELECT COUNT(*) AS total FROM user WHERE email = ?';
		db.query(checkUserQuery, [valid_email], (err, results) => {
			if (err) {
				console.error('Erreur lors de la vérification de l\'utilisateur :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			const userExists = results[0].total > 0;

			if (userExists) {
				return res.status(409).json({ message: 'Cet utilisateur existe déjà' });
			}

			// Insérer l'utilisateur dans la base de données
			const insertUserQuery = 'INSERT INTO user (firstname, surname, password, email) VALUES (?, ?, ?, ?)';
			bcrypt.hash(valid_password, saltRounds, (err, hash) => {
				if (err) {
				  console.error('Erreur lors du hachage du mot de passe :', err);
				  return res.status(500).json({ message: 'erreur serveur' });
				}
			  
				db.query(insertUserQuery, [valid_firstname, valid_surname, hash, valid_email], (err, results) => {
					if (err) {
						console.error('Erreur lors de l\'insertion de l\'utilisateur :', err);
						return res.status(500).json({ message: 'erreur serveur' });
					}
	
					return res.status(201).json({ message: 'Vous êtes enregistré.e avec succès' });
				});
			});
		});
	}
	else {
		return res.status(401).json({ message: 'Les mots de passe ne correspondent pas' });
	}
});

// Connexion
app.post('/log', requireLogout, (req, res) => {
	
	const { email, password } = req.body;
	
	const verif_password = validateUserInput(password, 'password', true);
	if(!verif_password.valid) {
		return res.status(401).json({ message: verif_password.message });
	}
	const valid_password = verif_password.sanitizedInput;

	const verif_email = validateUserInput(email, 'email', true);
	if(!verif_email.valid) {
		return res.status(401).json({ message: verif_email.message });
	}
	const valid_email = verif_email.sanitizedInput;
  
	// Vérifier si l'utilisateur existe dans la base de données
	const getUserQuery = 'SELECT * FROM user WHERE email = ?';
	db.query(getUserQuery, [valid_email], (err, results) => {
		if (err) {
			console.error('Erreur lors de la récupération de l\'utilisateur :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}
	
		if (results.length === 0) {
			return res.status(401).json({ message: 'Cet utilisateur n\'existe pas' });
		}
	
		const user = results[0];
	
		// Vérifier le mot de passe
		bcrypt.compare(valid_password, user.password, (err, isMatch) => {
			if (err) {
				console.error('Erreur lors de la comparaison des mots de passe :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}
	
			if (!isMatch) {
				return res.status(401).json({ message: 'Mot de passe incorrect' });
			}
	
			if(user.statut == "ADMIN")req.session.admin = true;
			req.session.isLoggedIn = true;
			// Vous pouvez également stocker d'autres informations de session si nécessaire
			req.session.userId = user.id_user;

			const getUserQuery = 'UPDATE user SET nb_connexion = nb_connexion + 1 WHERE email = ?';
			db.query(getUserQuery, [valid_email], (err, results) => {
				if (err) {
					console.error('Erreur lors de la récupération de l\'utilisateur :', err);
				}
			});
			
	
			return res.status(200).json({ message: 'Connection succeeded' });
		});
	});
});



function verifyFormatPhotoName(name) {
	var regex = /^(q|r)-([1-9]\d{0,2})$/; // Expression régulière pour vérifier le format
  
	return regex.test(name);
}


// Ajout deck
app.post('/add_deck', requireLogin, upload.any(), async (req, res) => {
	const { name, acces, tag, level, q, r } = req.body;

	const photos = req.files;

	if(q && r){

		if(q.length == r.length){
			if(photos.length > q.length * 2) {
				return res.status(401).json({ message: "Vous avez envoyé trop de photos" });
			} 
			
			let photosNameValidity = true;
			photos.forEach(async (elem) => {
				if(!verifyFormatPhotoName(elem.fieldname)){
					photosNameValidity = false
				}
			})
			if(!photosNameValidity)return res.status(401).json({ message: "Noms de photos invalides" });

			let imagesUploaded = [];

			const files = req.files;
			// Compression des images
			const compressedImages = await Promise.all(
				files.map(async (file) => {
					const compressedImage = await sharp(file.path)
						.toFormat('jpeg')
						.jpeg({ quality: 10 })
						.toBuffer()

					return {
						originalName: file.originalname,
						name:file.fieldname,
						buffer: compressedImage
					};
				})
			);

			const imagesWithinSizeLimit = compressedImages.filter((image) => image.buffer.length /*<= 500 * 1024*/);

			let errorWhileReUpload = false;
			// Enregistrez les images dans la limite de taille
			imagesWithinSizeLimit.forEach(async (image) => {
				// Générez un nom de fichier unique, par exemple en utilisant un horodatage ou un identifiant unique
				const newName = Date.now()+'-'+randTmp()+'-fichier.jpeg';
				const destinationPath = 'front/uploads/'+newName;
				imagesUploaded.push({
					type:image.name.split("-")[0],
					number:parseInt(image.name.split("-")[1]),
					name:newName
				});

				fs.writeFile(destinationPath, image.buffer, (err) => {
					if (err) {
						console.error('Erreur lors de l\'enregistrement de l\'image :', err);
						errorWhileReUpload = true;
						res.status(401).json({ message: "Erreur serveur lors de l'enregistrement des images" });
						// Gérez l'erreur (par exemple, renvoyer une réponse d'erreur appropriée au client)
					} else {
						console.log('Image enregistrée avec succès :', destinationPath);
						// Effectuez d'autres actions si nécessaire (par exemple, stockez le chemin de l'image dans une base de données)
					}
				});
			});

			// Supprimez les fichiers téléchargés du système de fichiers
			files.forEach((file) => {
				fs.unlinkSync(file.path);
			});

			if(errorWhileReUpload)return res.status(401).json({ message: "Erreur serveur" });
		
			const verif_name = validateUserInput(name, 'name', true);
			if(!verif_name.valid) {
				return res.status(401).json({ message: verif_name.message });
			}
			const valid_name = verif_name.sanitizedInput;

			const verif_acces = validateUserInput(acces, 'name', true);
			if(!verif_acces.valid) {c
			}
			const valid_acces = verif_acces.sanitizedInput;
			if(!(valid_acces === 'PRIVATE' || valid_acces === 'PUBLIC')) {
				return res.status(401).json({ message: 'Accessibilité non valide' });
			}

			const verif_tag = validateUserInput(tag, 'name', true);
			if(!verif_tag.valid) {
				return res.status(401).json({ message: verif_tag.message });
			}
			const valid_tag = verif_tag.sanitizedInput;

			const verif_level = validateUserInput(level, 'name', true);
			if(!verif_level.valid) {
				return res.status(401).json({ message: verif_level.message });
			}
			const valid_level = verif_level.sanitizedInput;

			let valid_q = [];
			let valid_r = [];
			for(let i = 0; i < q.length; i++){
				const verif_q = validateUserInput(q[i], 'name', true, true);
				if(!verif_q.valid) {
					return res.status(401).json({ message: verif_q.message });
				}
				valid_q.push(verif_q.sanitizedInput);

				const verif_r = validateUserInput(r[i], 'name', true, true);
				if(!verif_r.valid) {
					return res.status(401).json({ message: verif_r.message });
				}
				valid_r.push(verif_r.sanitizedInput);
			}

			
			//Vérifier si le tag existe
			const getUserQuery = 'SELECT * FROM tag WHERE id_tag = ?';
			db.query(getUserQuery, [valid_tag], (err, results) => {
				if (err) {
					console.error('Erreur lors de la récupération du tag :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
				}
			
				if (results.length === 0) {
					return res.status(401).json({ message: 'Matière non trouvée' });
				}

				//Vérifier si le niveau existe
				const getUserQuery = 'SELECT * FROM level WHERE id_level = ?';
				db.query(getUserQuery, [valid_level], (err, results) => {
					if (err) {
						console.error('Erreur lors de la récupération du level :', err);
						return res.status(500).json({ message: 'Erreur serveur' });
					}
				
					if (results.length === 0) {
						return res.status(401).json({ message: 'Niveau non trouvé' });
					}

					// Creation du code
					let code = '';
					if(valid_acces === 'PRIVATE') {
						console.log('création de code')
						var charTab = [
							'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
							'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
							'0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
							'!', '@', '*', '$', '-'
						];
						for (let i = 0; i < 10; i++) {
							code += charTab[Math.floor(Math.random() * charTab.length)];
						}

						const getUserQuery = 'SELECT * FROM deck WHERE code = ?';
						db.query(getUserQuery, [code], (err, results) => {
							if (err) {
								console.error('Erreur lors de la vérification de l\'existance du code :', err);
								return res.status(500).json({ message: 'Erreur serveur' });
							}
						
							if (results.length > 0) {
								code = '';
								for (let i = 0; i < 10; i++) {
									code += charTab[Math.floor(Math.random() * charTab.length)];
								}
								db.query(getUserQuery, [code], (err, results) => {
									if (err) {
										console.error('Erreur lors de la vérification de l\'existance du code :', err);
										return res.status(500).json({ message: 'Erreur serveur' });
									}

									if (results.length > 0) {
										return res.status(401).json({ message: 'Erreur serveur, re-tentez votre chance' });
									}
								});
							}

						});
						
					}
				
				
					// Insérer le deck dans la base de données
					const insertUserQuery = 'INSERT INTO deck (id_user, id_tag, id_level, name, acces_type, code, type) VALUES (?, ?, ?, ?, ?, ?, "DECK")';
					db.query(insertUserQuery, [req.session.userId, valid_tag, valid_level, valid_name, valid_acces, code], (err, results) => {
						if (err) {
							console.error('Erreur lors de l\'insertion du deck :', err);
							return res.status(500).json({ message: 'Erreur serveur' });
						}

						for(let i = 0; i < valid_q.length; i++){
							let img_q = imagesUploaded.find(img => img.number === (i+1) && img.type === "q") ? (imagesUploaded.find(img => img.number === (i+1) && img.type === "q")).name : "";
							let img_a = imagesUploaded.find(img => img.number === (i+1) && img.type === "r") ? (imagesUploaded.find(img => img.number === (i+1) && img.type === "r")).name : "";
							// Insérer les cartes
							const insertUserQuery = 'INSERT INTO card (id_deck, question, answer, img_q, img_a) VALUES (?, ?, ?, ?, ?)';
							db.query(insertUserQuery, [results.insertId, valid_q[i], valid_r[i], img_q, img_a], (err, results2) => {
								if (err) {
									console.error('Erreur lors de l\'insertion des cartes :', err);

									//Suppression du deck et des cartes si erreur

									return res.status(500).json({ message: 'Erreur serveur' });
								}
							});
						}

						return res.status(201).json({ message: 'Registration succeeded', id:results.insertId });
					});
				});
			});
		}
		else {
			return res.status(400).json({ message: 'Questions et réponses non uniformes' });
		}
	}
	else {
		return res.status(400).json({ message: 'Questions et réponses vides' });
	}
});


//Suppression deck
app.post('/ask_supp', requireLogin, (req, res) => {
	
	const verif_id_deck = validateUserInput(req.body.id_deck, 'name', false);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	let valid_id_deck = verif_id_deck.sanitizedInput;

	const verif_reason = validateUserInput(req.body.reason, 'name', false);
	if(!verif_reason.valid) {
		return res.status(401).json({ message: verif_reason.message });
	}
	let valid_reason = verif_reason.sanitizedInput;

	const query='SELECT (SELECT COUNT(*) FROM deck WHERE id_deck = ? && id_user = ?) AS deck_exist'
	db.query(query, [valid_id_deck, req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès au deck :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}
	
		if(rows[0].deck_exist <= 0) {
			return res.status(401).json({ message: 'Vous ne pouvez pas supprimer ce deck' });
		}
	
		const checkUserQuery = 'SELECT COUNT(*) as ask_exist FROM supp WHERE id_deck = ? AND id_user = ?';
		db.query(checkUserQuery, [valid_id_deck, req.session.userId], (err, supp) => {
			if (err) {
				console.error('Erreur lors de la récupération des demandes de suppression :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			if(supp[0].ask_exist > 0) {
				return res.status(401).json({ message: 'Vous avez déjà effectué une demande de suppression pour ce deck' });
			}

			const checkUserQuery = 'INSERT INTO supp (id_deck, id_user, reason) VALUES (?, ?, ?)';
			db.query(checkUserQuery, [valid_id_deck, req.session.userId, valid_reason], (err, results) => {
				if (err) {
					console.error('Erreur lors de l\'insersion de la demande de suppression :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
				}

				return res.status(200).json({ message: '' });
			});
		});
	});
});


// Modification deck
app.post('/modify_deck', requireLogin, (req, res) => {
	/*
	const { name, acces, tag, level, q, r, id_deck } = req.body;

	if(q && r){

		if(q.length == r.length){
		
			const verif_name = validateUserInput(name, 'name', true);
			if(!verif_name.valid) {
				return res.status(401).json({ message: verif_name.message });
			}
			const valid_name = verif_name.sanitizedInput;

			const verif_acces = validateUserInput(acces, 'name', true);
			if(!verif_acces.valid) {
				return res.status(401).json({ message: verif_acces.message });
			}
			const valid_acces = verif_acces.sanitizedInput;
			if(!(valid_acces === 'PRIVATE' || valid_acces === 'PUBLIC')) {
				return res.status(401).json({ message: 'Accessibilité non valide' });
			}

			const verif_tag = validateUserInput(tag, 'name', true);
			if(!verif_tag.valid) {
				return res.status(401).json({ message: verif_tag.message });
			}
			const valid_tag = verif_tag.sanitizedInput;

			const verif_level = validateUserInput(level, 'name', true);
			if(!verif_level.valid) {
				return res.status(401).json({ message: verif_level.message });
			}
			const valid_level = verif_level.sanitizedInput;

			let valid_q = [];
			let valid_r = [];
			for(let i = 0; i < q.length; i++){
				const verif_q = validateUserInput(q[i], 'name', true, true);
				if(!verif_q.valid) {
					return res.status(401).json({ message: verif_q.message });
				}
				valid_q.push(verif_q.sanitizedInput);

				const verif_r = validateUserInput(r[i], 'name', true, true);
				if(!verif_r.valid) {
					return res.status(401).json({ message: verif_r.message });
				}
				valid_r.push(verif_r.sanitizedInput);
			}


			const verif_id_deck = validateUserInput(id_deck, 'name', true);
			if(!verif_id_deck.valid) {
				return res.status(401).json({ message: verif_id_deck.message });
			}
			const valid_id_deck = verif_id_deck.sanitizedInput;

			
			//Vérifier si le tag existe
			const getUserQuery = 'SELECT * FROM tag WHERE id_tag = ?';
			db.query(getUserQuery, [valid_tag], (err, results) => {
				if (err) {
					console.error('Erreur lors de la récupération du tag :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
				}
			
				if (results.length === 0) {
					return res.status(401).json({ message: 'Matière non trouvée' });
				}

				//Vérifier si le niveau existe
				const getUserQuery = 'SELECT * FROM level WHERE id_level = ?';
				db.query(getUserQuery, [valid_level], (err, results) => {
					if (err) {
						console.error('Erreur lors de la récupération du level :', err);
						return res.status(500).json({ message: 'Erreur serveur' });
					}
				
					if (results.length === 0) {
						return res.status(401).json({ message: 'Niveau non trouvé' });
					}



					//Vérifier si le compte a créé le deck
					const getUserQuery = 'SELECT * FROM deck WHERE id_deck = ? && id_user = ?';
					db.query(getUserQuery, [valid_id_deck, req.session.userId], (err, results) => {
						if (err) {
							console.error('Erreur lors de la récupération du level :', err);
							return res.status(500).json({ message: 'Erreur serveur' });
						}
					
						if (results.length === 0) {
							return res.status(401).json({ message: 'Vous n\'avez pas crée ce deck' });
						}

						// Creation du code
						let code = '';
						if(valid_acces === 'PRIVATE') {
							console.log('création de code')
							var charTab = [
								'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
								'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
								'0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
								'!', '@', '*', '$', '-'
							];
							for (let i = 0; i < 10; i++) {
								code += charTab[Math.floor(Math.random() * charTab.length)];
							}
							console.log(code)

							const getUserQuery = 'SELECT * FROM deck WHERE code = ?';
							db.query(getUserQuery, [code], (err, results) => {
								if (err) {
									console.error('Erreur lors de la récupération du level :', err);
									return res.status(500).json({ message: 'Erreur serveur' });
								}
							
								if (results.length > 0) {
									code = '';
									for (let i = 0; i < 10; i++) {
										code += charTab[Math.floor(Math.random() * charTab.length)];
									}
									db.query(getUserQuery, [code], (err, results) => {
										if (err) {
											console.error('Erreur lors de la vérification de l\'existance du code :', err);
											return res.status(500).json({ message: 'Erreur serveur' });
										}
									
										console.log(results, results.length)
										if (results.length > 0) {
											return res.status(401).json({ message: 'Erreur serveur, re-tentez votre chance' });
										}
									});
								}
							});
						}
					
					
						// Update le deck dans la base de données
						const insertUserQuery = 'UPDATE deck SET id_user = ?, id_tag = ?, id_level = ?, name = ?, acces_type = ?, last_modification = CURRENT_TIMESTAMP, code = ? WHERE id_deck = ?';
						db.query(insertUserQuery, [req.session.userId, valid_tag, valid_level, valid_name, valid_acces, code, valid_id_deck], (err, results) => {
							if (err) {
								console.error('Erreur lors de la modification du deck :', err);
								return res.status(500).json({ message: 'Erreur serveur' });
							}

							const insertUserQuery = 'DELETE FROM card WHERE id_deck = ?';
							db.query(insertUserQuery, [valid_id_deck], (err, results) => {
								if (err) {
									console.error('Erreur lors de la suppression des anciennes cartes du deck :', err);
									return res.status(500).json({ message: 'Erreur serveur' });
								}

								for(let i = 0; i < valid_q.length; i++){
									// Insérer les cartes
									const insertUserQuery = 'INSERT INTO card (id_deck, question, answer) VALUES (?, ?, ?)';
									db.query(insertUserQuery, [valid_id_deck, valid_q[i], valid_r[i]], (err, results) => {
										if (err) {
											console.error('Erreur lors de l\'insertion des nouvelles cartes :', err);
			
											//Suppression du deck et des cartes si erreur
			
											return res.status(500).json({ message: 'Erreur serveur' });
										}
									});
								}
			
								return res.status(201).json({ message: 'Deck modifié avec succès', id:valid_id_deck });
							});
						});
					});
				});
			});
		}
		else {
			return res.status(400).json({ message: 'Questions et réponses non uniformes' });
		}
	}
	else {
		return res.status(400).json({ message: 'Questions et réponses vides' });
	}*/
	return res.status(400).json({ message: 'Requête obsolète' });
});


//Modification de deck
//Suppression d'une carte
app.post('/remove_card', requireLogin, (req, res) => {	
	const id_deck = req.body.id_deck;
	const id_card = req.body.id_card;
	
	console.log("Suppression de la carte : ", id_card)

	const verif_id_deck = validateUserInput(id_deck, 'name', true);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	const valid_id_deck = verif_id_deck.sanitizedInput;

	const verif_id_card = validateUserInput(id_card, 'name', true);
	if(!verif_id_card.valid) {
		return res.status(401).json({ message: verif_id_card.message });
	}
	const valid_id_card = verif_id_card.sanitizedInput;
	
	const query='SELECT (SELECT COUNT(*) FROM deck WHERE id_deck = ? && id_user = ?) AS deck_exist, (SELECT COUNT(*) FROM card WHERE id_deck = ? && id_card = ?) AS card_exist, (SELECT COUNT(*) FROM card WHERE id_deck = ?) AS nb_cards'
	db.query(query, [valid_id_deck, req.session.userId, valid_id_deck, valid_id_card, valid_id_deck], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès au deck :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}
	
		if(rows[0].deck_exist <= 0 || rows[0].card_exist <= 0) {
			return res.status(401).json({ message: 'Vous ne pouvez pas supprimer cette carte' });
		}

		if(rows[0].nb_cards <= 1){
			return res.status(401).json({ message: 'Vous ne pouvez pas supprimer la dernière carte' });
		}


		const query='SELECT img_q, img_a FROM card WHERE id_deck = ? && id_card = ?'
		db.query(query, [valid_id_deck, valid_id_card], (err, images) => {
			if (err) {
				console.error('Erreur lors de la récupération du level :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			if(images[0].img_q != "")fs.unlinkSync('front/uploads/'+images[0].img_q)
			if(images[0].img_a != "")fs.unlinkSync('front/uploads/'+images[0].img_a)

			const insertUserQuery = 'DELETE FROM card WHERE id_card = ?';
			db.query(insertUserQuery, [valid_id_card], (err, results) => {
				if (err) {
					console.error('Erreur lors de la suppression des anciennes cartes du deck :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
				}

				const insertUserQuery = 'DELETE FROM cards_score WHERE id_card = ?';
				db.query(insertUserQuery, [valid_id_card], (err, results) => {
					if (err) {
						console.error('Erreur lors de la suppression des scores de la carte :', err);
						return res.status(500).json({ message: 'Erreur serveur' });
					}

					const insertUserQuery = 'DELETE FROM train WHERE id_card = ?';
					db.query(insertUserQuery, [valid_id_card], (err, results) => {
						if (err) {
							console.error('Erreur lors de la suppression des entrainement de la carte :', err);
							return res.status(500).json({ message: 'Erreur serveur' });
						}

						return res.status(201).json({ message: 'Carte supprimée avec succès' });
					});
				});
			});
		});
	});
});


//Suppression d'un step
app.post('/remove_step', requireLogin, (req, res) => {	
	const id_deck = req.body.id_deck;
	const id_step = req.body.id_step;
	
	console.log("Suppression de l'étape : ", id_step)

	const verif_id_deck = validateUserInput(id_deck, 'name', true);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	const valid_id_deck = verif_id_deck.sanitizedInput;

	const verif_id_step = validateUserInput(id_step, 'name', true);
	if(!verif_id_step.valid) {
		return res.status(401).json({ message: verif_id_step.message });
	}
	const valid_id_step = verif_id_step.sanitizedInput;
	
	const query='SELECT (SELECT COUNT(*) FROM deck WHERE id_deck = ? && id_user = ?) AS deck_exist, (SELECT COUNT(*) FROM step WHERE id_deck = ? && id_step = ?) AS step_exist, (SELECT COUNT(*) FROM step WHERE id_deck = ?) AS nb_steps'
	db.query(query, [valid_id_deck, req.session.userId, valid_id_deck, valid_id_step, valid_id_deck], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès au deck :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}
	
		if(rows[0].deck_exist <= 0 || rows[0].step_exist <= 0) {
			return res.status(401).json({ message: 'Vous ne pouvez pas supprimer cette étape' });
		}

		if(rows[0].nb_steps <= 1){
			return res.status(401).json({ message: 'Vous ne pouvez pas supprimer la denière étape' });
		}


		const query='SELECT content, type FROM step WHERE id_deck = ? && id_step = ?'
		db.query(query, [valid_id_deck, valid_id_step], (err, step) => {
			if (err) {
				console.error('Erreur lors de la récupération de l\'étape :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			if(step.length <= 0) {
				return res.status(401).json({ message: 'Etape non trouvée' });
			}

			switch (step[0].type) {
				case "CARDS":
					console.log("Suppression des cartes")
					const query='SELECT id_card, img_q, img_a FROM card WHERE id_deck = ? && id_step = ?'
					db.query(query, [valid_id_deck, valid_id_step], (err, cards) => {
						if (err) {
							console.error('Erreur lors de la récupération du level :', err);
							return res.status(500).json({ message: 'Erreur serveur' });
						}
						
						cards.forEach(card => {
							if(card.img_q != "")fs.unlinkSync('front/uploads/'+card.img_q)
							if(card.img_a != "")fs.unlinkSync('front/uploads/'+card.img_a)

							const insertUserQuery = 'DELETE FROM card WHERE id_card = ?';
							db.query(insertUserQuery, [card.id_card], (err, results) => {
								if (err) {
									console.error('Erreur lors de la suppression des anciennes cartes du deck :', err);
									return res.status(500).json({ message: 'Erreur serveur' });
								}

								const insertUserQuery = 'DELETE FROM cards_score WHERE id_card = ?';
								db.query(insertUserQuery, [card.id_card], (err, results) => {
									if (err) {
										console.error('Erreur lors de la suppression des scores de la carte :', err);
										return res.status(500).json({ message: 'Erreur serveur' });
									}

									const insertUserQuery = 'DELETE FROM train WHERE id_card = ?';
									db.query(insertUserQuery, [card.id_card], (err, results) => {
										if (err) {
											console.error('Erreur lors de la suppression des entrainement de la carte :', err);
											return res.status(500).json({ message: 'Erreur serveur' });
										}

									});
								});
							});
						})
						
					});
					break;
				case "IMG":
					
					if(step[0].content != "")fs.unlinkSync('front/uploads/'+step[0].content)
					console.log("Suppression de l'image")

					break;
				case "PDF":
					
					if(step[0].content != "")fs.unlinkSync('front/uploads/'+step[0].content)
					console.log("Suppression du pdf")
						
					break;
			
				default:
					break;
			}

			const suppStepQuery = 'DELETE FROM step WHERE id_deck = ? && id_step = ?';
			db.query(suppStepQuery, [valid_id_deck, valid_id_step], (err, results) => {
				if (err) {
					console.error('Erreur lors de la suppression de l\'étape :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
				}

				if(results.affectedRows == 0) {
					return res.status(201).json({ message: 'Etape non trouvée' });
				}

				return res.status(201).json({ message: 'Etape et contenu supprimées avec succès' });
			});

			
		});
	});
});

//Suppression d'une photo
app.post('/remove_img', requireLogin, (req, res) => {
	
	const id_deck = req.body.id_deck;
	const id_card = req.body.id_card;
	const side = req.body.side;

	console.log("Suppression de l'image de la carte : ", id_card, ", coté : ", side)
	
	const verif_id_deck = validateUserInput(id_deck, 'name', true);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	const valid_id_deck = verif_id_deck.sanitizedInput;

	const verif_id_card = validateUserInput(id_card, 'name', true);
	if(!verif_id_card.valid) {
		return res.status(401).json({ message: verif_id_card.message });
	}
	const valid_id_card = verif_id_card.sanitizedInput;

	const verif_side = validateUserInput(side, 'name', true);
	if(!verif_side.valid) {
		return res.status(401).json({ message: verif_side.message });
	}
	const valid_side = verif_side.sanitizedInput;

	if(valid_side != "Q" && valid_side != "R") {
		return res.status(401).json({ message:"Valeur non valide" });
	}
	const query='SELECT (SELECT COUNT(*) FROM deck WHERE id_deck = ? && id_user = ?) AS deck_exist, (SELECT COUNT(*) FROM card WHERE id_deck = ? && id_card = ?) AS card_exist'
	db.query(query, [valid_id_deck, req.session.userId, valid_id_deck, valid_id_card, valid_id_deck], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès au deck :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}
	
		if(rows[0].deck_exist <= 0 || rows[0].card_exist <= 0) {
			return res.status(401).json({ message: 'Vous ne pouvez pas supprimer cette photo' });
		}

		const query='SELECT img_q, img_a FROM card WHERE id_deck = ? && id_card = ?'
		db.query(query, [valid_id_deck, valid_id_card], (err, images) => {
			if (err) {
				console.error('Erreur lors de la récupération du level :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			let img_q = images[0].img_q;
			if(valid_side == "Q") {
				if(images[0].img_q != "")fs.unlinkSync('front/uploads/'+images[0].img_q);
				img_q = "";
			}
			let img_a = images[0].img_a;
			if(valid_side == "R") {
				if(images[0].img_a != "")fs.unlinkSync('front/uploads/'+images[0].img_a);
				img_a = "";
			}


			const insertUserQuery = 'UPDATE card SET img_q = ?, img_a = ? WHERE id_card = ?';
			db.query(insertUserQuery, [img_q, img_a, valid_id_card], (err, results2) => {
				if (err) {
					console.error('Erreur lors de l\'insertion des cartes :', err);

				}
				return res.status(201).json({ message: 'Image supprimée avec succès' });
			});
		});
	});
});



//Modification d'une carte
app.post('/update_card', requireLogin, upload.any(), async (req, res) => {
	
	const id_deck = req.body.id_deck;
	const id_card = req.body.id_card;
	const q = req.body.q;
	const r = req.body.r;

	const photos = req.files;
	
	const verif_id_deck = validateUserInput(id_deck, 'name', true);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	const valid_id_deck = verif_id_deck.sanitizedInput;

	const verif_id_card = validateUserInput(id_card, 'name', true);
	if(!verif_id_card.valid) {
		return res.status(401).json({ message: verif_id_card.message });
	}
	const valid_id_card = verif_id_card.sanitizedInput;

	const verif_q = validateUserInput(q, 'name', true);
	if(!verif_q.valid) {
		return res.status(401).json({ message: verif_q.message });
	}
	const valid_q = verif_q.sanitizedInput;

	const verif_r = validateUserInput(r, 'name', true);
	if(!verif_r.valid) {
		return res.status(401).json({ message: verif_r.message });
	}
	const valid_r = verif_r.sanitizedInput;
	
	if(photos.length > 2) {
		return res.status(401).json({ message: "Vous avez envoyé trop de photos" });
	} 
	
	let photosNameValidity = true;
	photos.forEach(async (elem) => {
		if(elem.fieldname != "img_front" && elem.fieldname != "img_back"){
			photosNameValidity = false
		}
	})
	if(!photosNameValidity)return res.status(401).json({ message: "Noms de photos invalides" });

	let imagesUploaded = [];

	const files = req.files;
	// Compression des images
	const compressedImages = await Promise.all(
		files.map(async (file) => {
			const compressedImage = await sharp(file.path)
				.toFormat('jpeg')
				.jpeg({ quality: 10 })
				.toBuffer()

			return {
				originalName: file.originalname,
				name:file.fieldname,
				buffer: compressedImage
			};
		})
	);

	const imagesWithinSizeLimit = compressedImages.filter((image) => image.buffer.length /*<= 500 * 1024*/);

	let errorWhileReUpload = false;
	// Enregistrez les images dans la limite de taille
	imagesWithinSizeLimit.forEach(async (image) => {
		// Générez un nom de fichier unique, par exemple en utilisant un horodatage ou un identifiant unique
		const newName = Date.now()+'-'+randTmp()+'-fichier.jpeg';
		const destinationPath = 'front/uploads/'+newName;
		imagesUploaded.push({
			side:image.name,
			name:newName
		});

		fs.writeFile(destinationPath, image.buffer, (err) => {
			if (err) {
				console.error('Erreur lors de l\'enregistrement de l\'image :', err);
				errorWhileReUpload = true;
				res.status(401).json({ message: "Erreur serveur lors de l'enregistrement des images" });
				// Gérez l'erreur (par exemple, renvoyer une réponse d'erreur appropriée au client)
			} else {
				console.log('Image enregistrée avec succès :', destinationPath);
				// Effectuez d'autres actions si nécessaire (par exemple, stockez le chemin de l'image dans une base de données)
			}
		});
	});

	// Supprimez les fichiers téléchargés du système de fichiers
	files.forEach((file) => {
		fs.unlinkSync(file.path);
	});

	if(errorWhileReUpload)return res.status(401).json({ message: "Erreur serveur" });
	
	const query='SELECT (SELECT COUNT(*) FROM deck WHERE id_deck = ? && id_user = ?) AS deck_exist, (SELECT COUNT(*) FROM card WHERE id_deck = ? && id_card = ?) AS card_exist'
	db.query(query, [valid_id_deck, req.session.userId, valid_id_deck, valid_id_card, valid_id_deck], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès au deck :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}
	
		if(rows[0].deck_exist <= 0 || rows[0].card_exist <= 0) {
			imagesUploaded.forEach((file) => {
				fs.unlinkSync('front/uploads/'+file.name);
			});
			return res.status(401).json({ message: 'Vous ne pouvez pas modifier cette carte' });
		}

		const query='SELECT img_q, img_a FROM card WHERE id_deck = ? && id_card = ?'
		db.query(query, [valid_id_deck, valid_id_card], (err, old_img) => {
			if (err) {
				console.error('Erreur lors de la vérification de l\'accès au deck :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			let img_q = old_img[0].img_q;
			if(imagesUploaded.find(img => img.side === "img_front")) {
				if(old_img[0].img_q != ""){
					fs.unlinkSync('front/uploads/'+old_img[0].img_q);
				}
				img_q = imagesUploaded.find(img => img.side === "img_front").name
			}

			let img_a = old_img[0].img_a;
			if(imagesUploaded.find(img => img.side === "img_back")) {
				if(old_img[0].img_a != ""){
					fs.unlinkSync('front/uploads/'+old_img[0].img_a);
				}
				img_a = imagesUploaded.find(img => img.side === "img_back").name
			}

			const insertUserQuery = 'UPDATE card SET question = ?, answer = ?, img_q = ?, img_a = ? WHERE id_card = ?';
			db.query(insertUserQuery, [valid_q, valid_r, img_q, img_a, valid_id_card], (err, results2) => {
				if (err) {
					console.error('Erreur lors de l\'insertion des cartes :', err);
					imagesUploaded.forEach((file) => {
						fs.unlinkSync('front/uploads/'+file.name);
					});
				}
				return res.status(201).json({ message: 'Registration succeeded', id:valid_id_deck });
			});
		});
	});
});


//Ajout de cartes
app.post('/add_cards', requireLogin, upload.any(), async  (req, res) => {
		
	const { id_deck, q, r } = req.body;

	const photos = req.files;

	const verif_id_deck = validateUserInput(id_deck, 'name', true);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	const valid_id_deck = verif_id_deck.sanitizedInput;

	if(q && r){

		if(q.length == r.length){
			if(photos.length > q.length * 2) {
				return res.status(401).json({ message: "Vous avez envoyé trop de photos" });
			} 
			
			let photosNameValidity = true;
			photos.forEach(async (elem) => {
				if(!verifyFormatPhotoName(elem.fieldname)){
					photosNameValidity = false
				}
			})
			if(!photosNameValidity)return res.status(401).json({ message: "Noms de photos invalides" });

			let imagesUploaded = [];

			const files = req.files;
			// Compression des images
			const compressedImages = await Promise.all(
				files.map(async (file) => {
					const compressedImage = await sharp(file.path)
						.toFormat('jpeg')
						.jpeg({ quality: 10 })
						.toBuffer()

					return {
						originalName: file.originalname,
						name:file.fieldname,
						buffer: compressedImage
					};
				})
			);

			const imagesWithinSizeLimit = compressedImages.filter((image) => image.buffer.length /*<= 500 * 1024*/);

			let errorWhileReUpload = false;
			// Enregistrez les images dans la limite de taille
			imagesWithinSizeLimit.forEach(async (image) => {
				// Générez un nom de fichier unique, par exemple en utilisant un horodatage ou un identifiant unique
				const newName = Date.now()+'-'+randTmp()+'-fichier.jpeg';
				const destinationPath = 'front/uploads/'+newName;
				imagesUploaded.push({
					type:image.name.split("-")[0],
					number:parseInt(image.name.split("-")[1]),
					name:newName
				});

				fs.writeFile(destinationPath, image.buffer, (err) => {
					if (err) {
						console.error('Erreur lors de l\'enregistrement de l\'image :', err);
						errorWhileReUpload = true;
						res.status(401).json({ message: "Erreur serveur lors de l'enregistrement des images" });
						// Gérez l'erreur (par exemple, renvoyer une réponse d'erreur appropriée au client)
					} else {
						console.log('Image enregistrée avec succès :', destinationPath);
						// Effectuez d'autres actions si nécessaire (par exemple, stockez le chemin de l'image dans une base de données)
					}
				});
			});

			// Supprimez les fichiers téléchargés du système de fichiers
			files.forEach((file) => {
				fs.unlinkSync(file.path);
			});

			if(errorWhileReUpload)return res.status(401).json({ message: "Erreur serveur" });

			const query='SELECT (SELECT COUNT(*) FROM deck WHERE id_deck = ? && id_user = ?) AS deck_exist'
			db.query(query, [valid_id_deck, req.session.userId], (err, rows) => {
				if (err) {
					console.error('Erreur lors de la vérification de l\'accès au deck :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
				}
			
				if(rows[0].deck_exist <= 0) {
					// Supprimez les fichiers téléchargés du système de fichiers
					imagesUploaded.forEach((file) => {
						fs.unlinkSync('front/uploads/'+file.name);
					});
					return res.status(401).json({ message: 'Vous ne pouvez pas ajouter des cartes dans ce deck' });
				}

				const query='SELECT id_user FROM consult WHERE id_deck = ?'
				db.query(query, [valid_id_deck, req.session.userId], (err, consults) => {
					if (err) {
						console.error('Erreur lors de la récupération des utilisateur qui utilisent le deck :', err);
						return res.status(500).json({ message: 'Erreur serveur' });
					}
				

					let valid_q = [];
					let valid_r = [];
					for(let i = 0; i < q.length; i++){
						const verif_q = validateUserInput(q[i], 'name', true, true);
						if(!verif_q.valid) {
							return res.status(401).json({ message: verif_q.message });
						}
						valid_q.push(verif_q.sanitizedInput);

						const verif_r = validateUserInput(r[i], 'name', true, true);
						if(!verif_r.valid) {
							return res.status(401).json({ message: verif_r.message });
						}
						valid_r.push(verif_r.sanitizedInput);
					}

					for(let i = 0; i < valid_q.length; i++){
						let img_q = imagesUploaded.find(img => img.number === (i+1) && img.type === "q") ? (imagesUploaded.find(img => img.number === (i+1) && img.type === "q")).name : "";
						let img_a = imagesUploaded.find(img => img.number === (i+1) && img.type === "r") ? (imagesUploaded.find(img => img.number === (i+1) && img.type === "r")).name : "";
						// Insérer les cartes
						const insertCardsQuery = 'INSERT INTO card (id_deck, question, answer, img_q, img_a) VALUES (?, ?, ?, ?, ?)';
						db.query(insertCardsQuery, [valid_id_deck, valid_q[i], valid_r[i], img_q, img_a], (err, results2) => {
							if (err) {
								console.error('Erreur lors de l\'insertion des nouvelles cartes :', err);

								return res.status(500).json({ message: 'Erreur serveur' });
							}
							for(let elem of consults){
								const insertCardsScoreQuery = 'INSERT INTO cards_score (id_card, id_user, id_deck) VALUES (?, ?, ?)';
								db.query(insertCardsScoreQuery, [results2.insertId, elem.id_user, valid_id_deck, valid_q[i], valid_r[i], img_q, img_a], (err, results2) => {
									if (err) {
										console.error('Erreur lors de l\'insertion des nouveaux score de cartes :', err);
			
										//Suppression du deck et des cartes si erreur
			
										return res.status(500).json({ message: 'Erreur serveur' });
									}
								});
							}

						});
						
					}

					return res.status(201).json({ message: 'Registration succeeded', id:valid_id_deck });
				});
			});
		}
		else {
			return res.status(400).json({ message: 'Questions et réponses non uniformes' });
		}
	}
	else {
		return res.status(400).json({ message: 'Questions et réponses vides' });
	}
});



// Modification infos deck
app.post('/update_infos_deck', requireLogin, upload.none(), async (req, res) => {
	const { name, acces, tag, level, id_deck } = req.body;

	const verif_name = validateUserInput(name, 'name', true);
	if(!verif_name.valid) {
		return res.status(401).json({ message: verif_name.message });
	}
	const valid_name = verif_name.sanitizedInput;

	const verif_acces = validateUserInput(acces, 'name', true);
	if(!verif_acces.valid) {
		return res.status(401).json({ message: verif_acces.message });
	}
	const valid_acces = verif_acces.sanitizedInput;
	if(!(valid_acces === 'PRIVATE' || valid_acces === 'PUBLIC')) {
		return res.status(401).json({ message: 'Accessibilité non valide' });
	}

	const verif_tag = validateUserInput(tag, 'name', true);
	if(!verif_tag.valid) {
		return res.status(401).json({ message: verif_tag.message });
	}
	const valid_tag = verif_tag.sanitizedInput;

	const verif_level = validateUserInput(level, 'name', true);
	if(!verif_level.valid) {
		return res.status(401).json({ message: verif_level.message });
	}
	const valid_level = verif_level.sanitizedInput;


	const verif_id_deck = validateUserInput(id_deck, 'name', true);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	const valid_id_deck = verif_id_deck.sanitizedInput;

	const query='SELECT (SELECT COUNT(*) FROM deck WHERE id_deck = ? && id_user = ?) AS deck_exist'
	db.query(query, [valid_id_deck, req.session.userId], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la récupération vérification de l\'accès au deck :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}
	
		if(rows[0].deck_exist <= 0) {
			return res.status(401).json({ message: 'Vous ne pouvez pas modifier ce deck' });
		}
		//Vérifier si le tag existe
		const getUserQuery = 'SELECT * FROM tag WHERE id_tag = ?';
		db.query(getUserQuery, [valid_tag], (err, results) => {
			if (err) {
				console.error('Erreur lors de la récupération du tag :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}
		
			if (results.length === 0) {
				return res.status(401).json({ message: 'Matière non trouvée' });
			}

			//Vérifier si le niveau existe
			const getUserQuery = 'SELECT * FROM level WHERE id_level = ?';
			db.query(getUserQuery, [valid_level], (err, results) => {
				if (err) {
					console.error('Erreur lors de la récupération du level :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
				}
			
				if (results.length === 0) {
					return res.status(401).json({ message: 'Niveau non trouvé' });
				}

				// Creation du code
				let code = '';
				if(valid_acces === 'PRIVATE') {
					console.log('création de code')
					var charTab = [
						'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
						'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
						'0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
						'!', '@', '*', '$', '-'
					];
					for (let i = 0; i < 10; i++) {
						code += charTab[Math.floor(Math.random() * charTab.length)];
					}

					const getUserQuery = 'SELECT * FROM deck WHERE code = ?';
					db.query(getUserQuery, [code], (err, results) => {
						if (err) {
							console.error('Erreur lors de la vérification de l\'existance du code :', err);
							return res.status(500).json({ message: 'Erreur serveur' });
						}
					
						if (results.length > 0) {
							code = '';
							for (let i = 0; i < 10; i++) {
								code += charTab[Math.floor(Math.random() * charTab.length)];
							}
							db.query(getUserQuery, [code], (err, results) => {
								if (err) {
									console.error('Erreur lors de la vérification de l\'existance du code :', err);
									return res.status(500).json({ message: 'Erreur serveur' });
								}
								if (results.length > 0) {
									return res.status(401).json({ message: 'Erreur serveur, re-tentez votre chance' });
								}
							});
						}
					});
				}
			
			
				// Update le deck dans la base de données
				const insertUserQuery = 'UPDATE deck SET id_tag = ?, id_level = ?, name = ?, acces_type = ?, last_modification = CURRENT_TIMESTAMP, code = ? WHERE id_deck = ?';
				db.query(insertUserQuery, [valid_tag, valid_level, valid_name, valid_acces, code, valid_id_deck], (err, results) => {
					if (err) {
						console.error('Erreur lors de la modification du deck :', err);
						return res.status(500).json({ message: 'Erreur serveur' });
					}

					return res.status(201).json({ message: 'Deck modifié avec succès', id:valid_id_deck });
				});
			});
		});
	});
});






//Récupération des tags
app.post('/get_all_tag', requireLogin, (req, res) => {
	const checkUserQuery = 'SELECT * FROM tag';
	db.query(checkUserQuery, (err, results) => {
		if (err) {
			console.error('Erreur lors de la récupération des tags :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		return res.status(200).json({ message: '', data:results });
	});
});

//Récupération des levels
app.post('/get_all_level', (req, res) => {
	const checkUserQuery = 'SELECT * FROM level';
	db.query(checkUserQuery, (err, results) => {
		if (err) {
			console.error('Erreur lors de la récupération des niveaux :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		return res.status(200).json({ message: '', data:results });
	});
});


//Ajout de tags
app.post('/add_tag', requireLogin, (req, res) => {
	if(!req.session.admin) {
		return res.redirect('/home');
	}
	const verif_tag = validateUserInput(req.body.tag, 'name', false);
	if(!verif_tag.valid) {
		return res.status(401).json({ message: verif_tag.message });
	}
	let valid_tag = verif_tag.sanitizedInput;
	const verif_full_name = validateUserInput(req.body.full_name, 'name', false);
	if(!verif_full_name.valid) {
		return res.status(401).json({ message: verif_full_name.message });
	}
	let valid_full_name = verif_full_name.sanitizedInput;
	
	const checkUserQuery = 'SELECT COUNT(*) as tag_exist FROM tag WHERE tag = ?';
	db.query(checkUserQuery, [valid_tag], (err, tag) => {
		if (err) {
			console.error('Erreur lors de la récupération des tags :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		console.log(tag)

		if(tag[0].tag_exist > 0) {
			return res.status(401).json({ message: 'Ce tag existe déjà' });
		}

		const checkUserQuery = 'INSERT INTO tag (tag, full_name) VALUES (?, ?)';
		db.query(checkUserQuery, [valid_tag, valid_full_name], (err, results) => {
			if (err) {
				console.error('Erreur lors de l\'ajout du tag :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			return res.status(200).json({ message: '' });
		});
	});
});

//Ajout de levels
app.post('/add_level', requireLogin, (req, res) => {
	if(!req.session.admin) {
		return res.redirect('/home');
	}
	const verif_level = validateUserInput(req.body.level, 'name', false);
	if(!verif_level.valid) {
		return res.status(401).json({ message: verif_level.message });
	}
	let valid_level = verif_level.sanitizedInput;
	const verif_full_name = validateUserInput(req.body.full_name, 'name', false);
	if(!verif_full_name.valid) {
		return res.status(401).json({ message: verif_full_name.message });
	}
	let valid_full_name = verif_full_name.sanitizedInput;
	
	const checkUserQuery = 'SELECT COUNT(*) as level_exist FROM level WHERE level = ?';
	db.query(checkUserQuery, [valid_level], (err, level) => {
		if (err) {
			console.error('Erreur lors de la récupération des levels :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		console.log(level)

		if(level[0].level_exist > 0) {
			return res.status(401).json({ message: 'Ce tag existe déjà' });
		}

		const checkUserQuery = 'INSERT INTO level (level, full_name) VALUES (?, ?)';
		db.query(checkUserQuery, [valid_level, valid_full_name], (err, results) => {
			if (err) {
				console.error('Erreur lors de l\'ajout du level :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			return res.status(200).json({ message: '' });
		});
	});
});


//Suppression de tag
app.post('/supp_tag', requireLogin, (req, res) => {
	if(!req.session.admin) {
		return res.redirect('/home');
	}
	
	const verif_id_tag = validateUserInput(req.body.id_tag, 'name', false);
	if(!verif_id_tag.valid) {
		return res.status(401).json({ message: verif_id_tag.message });
	}
	let valid_id_tag = verif_id_tag.sanitizedInput;

	const checkUserQuery = 'DELETE FROM tag WHERE id_tag = ?';
	db.query(checkUserQuery, [valid_id_tag], (err, resultSupp) => {
		if (err) {
			console.error('Erreur lors de la suppression du tag :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		if(resultSupp.affectedRows == 0) {
			return res.status(401).json({ message: 'Tag non trouvé' });
		}

		return res.status(200).json({ message: 'Tag supprimée' });
	});
});



//Suppression de tag
app.post('/supp_level', requireLogin, (req, res) => {
	if(!req.session.admin) {
		return res.redirect('/home');
	}
	
	const verif_id_level = validateUserInput(req.body.id_level, 'name', false);
	if(!verif_id_level.valid) {
		return res.status(401).json({ message: verif_id_level.message });
	}
	let valid_id_level = verif_id_level.sanitizedInput;

	const checkUserQuery = 'DELETE FROM level WHERE id_level = ?';
	db.query(checkUserQuery, [valid_id_level], (err, resultSupp) => {
		if (err) {
			console.error('Erreur lors de la suppression du level :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		if(resultSupp.affectedRows == 0) {
			return res.status(401).json({ message: 'Level non trouvé' });
		}

		return res.status(200).json({ message: 'Level supprimée' });

	});
});



//Suppression de deck
app.post('/supp_deck', requireLogin, (req, res) => {
	if(!req.session.admin) {
		return res.redirect('/home');
	}
	const verif_id_deck = validateUserInput(req.body.id_deck, 'name', false);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	let valid_id_deck = verif_id_deck.sanitizedInput;
	
	const checkUserQuery = 'SELECT COUNT(*) as supp_ask_exist FROM supp WHERE id_deck = ?';
	db.query(checkUserQuery, [valid_id_deck], (err, level) => {
		if (err) {
			console.error('Erreur lors de la récupération des levels :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		if(level[0].supp_ask_exist <= 0) {
			return res.status(401).json({ message: 'Aucune demande pour ce deck' });
		}

		// Le inner join consult apporte une sécurité car on ne supprime pas si la tabla supp renvoyée est vide
		const checkUserQuery = `
		DELETE deck, consult, supp, card, step, cards_score, train, vote
		FROM deck
		LEFT JOIN consult ON consult.id_deck = deck.id_deck
		INNER JOIN supp ON supp.id_deck = deck.id_deck
		LEFT JOIN card ON card.id_deck = deck.id_deck
		LEFT JOIN step ON step.id_deck = deck.id_deck
		LEFT JOIN cards_score ON cards_score.id_deck = deck.id_deck
		LEFT JOIN train ON train.id_deck = deck.id_deck
		LEFT JOIN vote ON vote.id_deck = deck.id_deck
		WHERE deck.id_deck = ?
		`;
		db.query(checkUserQuery, [valid_id_deck], (err, resultSupp) => {
			if (err) {
				console.error('Erreur lors de la récupération des levels :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}


			return res.status(200).json({ message: 'Deck supprimée' });
		});
	});
});




// Refus suppression deck
app.post('/refuse_supp', requireLogin, async (req, res) => {

	console.log(req.body)
	
	const verif_id_deck = validateUserInput(req.body.id_deck, 'name', false);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	let valid_id_deck = verif_id_deck.sanitizedInput;

	const checkUserQuery = 'SELECT COUNT(*) as supp_ask_exist FROM supp WHERE id_deck = ?';
	db.query(checkUserQuery, [valid_id_deck], (err, supp) => {
		if (err) {
			console.error('Erreur lors de la récupération des levels :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		if(supp[0].supp_ask_exist <= 0) {
			return res.status(401).json({ message: 'Aucune demande pour ce deck' });
		}

		const checkUserQuery = 'DELETE FROM supp WHERE id_deck = ?';
		db.query(checkUserQuery, [valid_id_deck], (err, resultSupp) => {
			if (err) {
				console.error('Erreur lors de la récupération des levels :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}


			return res.status(200).json({ message: 'Demande supprimée' });
		});
	});
});



//Recherche de decks
app.post('/search_deck', requireLogin,  async (req, res) => {
	const { name, tags, levels } = req.body;
	
	const verif_name = validateUserInput(name, 'name', false);
	if(!verif_name.valid) {
		return res.status(401).json({ message: verif_name.message });
	}
	let valid_name = verif_name.sanitizedInput;
	
	let valid_tags = [];
	if(tags){
		for(let i = 0; i < tags.length; i++){
			const verif_tags = validateUserInput(tags[i], 'name', false);
			if(!verif_tags.valid) {
				return res.status(401).json({ message: verif_tags.message });
			}
			valid_tags.push(verif_tags.sanitizedInput);
		}
	}

	let valid_levels = [];
	if(levels){
		for(let i = 0; i < levels.length; i++){
			const verif_levels = validateUserInput(levels[i], 'name', false);
			if(!verif_levels.valid) {
				return res.status(401).json({ message: verif_levels.message });
			}
			valid_levels.push(verif_levels.sanitizedInput);
		}
	}


	if(!valid_name) {
		valid_name = '';
	}
	valid_name+='%';

	let query = `
	SELECT COUNT(DISTINCT card.id_card) AS card_count,
		COUNT(DISTINCT step.id_step) AS step_count, 
		(SELECT COUNT(*) FROM consult WHERE consult.id_deck = deck.id_deck && consult.id_user = ?) AS consult, 
		deck.id_deck, 
		deck.name, 
		deck.up_vote, 
		deck.down_vote,
		deck.type,
		tag.tag, 
		level.level, 
		user.firstname, 
		user.surname
	FROM deck
	INNER JOIN tag ON deck.id_tag = tag.id_tag
	INNER JOIN level ON deck.id_level = level.id_level
	INNER JOIN user ON deck.id_user = user.id_user
	LEFT JOIN card ON deck.id_deck = card.id_deck
	LEFT JOIN step ON deck.id_deck = step.id_deck
	WHERE deck.name LIKE ? 
	AND deck.id_tag IN (?)
	AND deck.id_level IN (?)
	AND deck.acces_type = "PUBLIC"
	GROUP BY deck.id_deck
	ORDER BY deck.name ASC
	`;
	if((!valid_tags || valid_tags.length == 0) && valid_levels){
		query = `SELECT COUNT(DISTINCT card.id_card) AS card_count, COUNT(DISTINCT step.id_step) AS step_count, (SELECT COUNT(*) FROM consult WHERE consult.id_deck = deck.id_deck && consult.id_user = ?) AS consult, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.type, tag.tag, level.level, user.firstname, user.surname FROM deck INNER JOIN tag ON deck.id_tag = tag.id_tag INNER JOIN level ON deck.id_level = level.id_level INNER JOIN user ON deck.id_user = user.id_user LEFT JOIN card ON deck.id_deck = card.id_deck LEFT JOIN step ON deck.id_deck = step.id_deck WHERE deck.name LIKE ? && deck.id_tag IN (SELECT id_tag FROM tag) && deck.id_level IN (?) AND deck.acces_type = "PUBLIC" GROUP BY deck.id_deck ORDER BY name ASC`;
		valid_tags = valid_levels;
	}

	if((!valid_levels || valid_levels.length == 0) && valid_tags){
		query = `SELECT COUNT(DISTINCT card.id_card) AS card_count, COUNT(DISTINCT step.id_step) AS step_count, (SELECT COUNT(*) FROM consult WHERE consult.id_deck = deck.id_deck && consult.id_user = ?) AS consult, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.type, tag.tag, level.level, user.firstname, user.surname FROM deck INNER JOIN tag ON deck.id_tag = tag.id_tag INNER JOIN level ON deck.id_level = level.id_level INNER JOIN user ON deck.id_user = user.id_user LEFT JOIN card ON deck.id_deck = card.id_deck LEFT JOIN step ON deck.id_deck = step.id_deck WHERE deck.name LIKE ? && deck.id_tag IN (?) && deck.id_level IN (SELECT id_level FROM level) AND deck.acces_type = "PUBLIC" GROUP BY deck.id_deck ORDER BY name ASC`;
	}

	if((!valid_tags || valid_tags.length == 0) && (!valid_levels || valid_levels.length == 0)){
		query = `SELECT COUNT(DISTINCT card.id_card) AS card_count, COUNT(DISTINCT step.id_step) AS step_count, (SELECT COUNT(*) FROM consult WHERE consult.id_deck = deck.id_deck && consult.id_user = ?) AS consult, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.type, tag.tag, level.level, user.firstname, user.surname FROM deck INNER JOIN tag ON deck.id_tag = tag.id_tag INNER JOIN level ON deck.id_level = level.id_level INNER JOIN user ON deck.id_user = user.id_user LEFT JOIN card ON deck.id_deck = card.id_deck LEFT JOIN step ON deck.id_deck = step.id_deck WHERE deck.name LIKE ? && deck.id_tag IN (SELECT id_tag FROM tag) && deck.id_level IN (SELECT id_level FROM level) AND deck.acces_type = "PUBLIC" GROUP BY deck.id_deck ORDER BY name ASC`;
	}
	
	db.query(query, [req.session.userId, valid_name, valid_tags, valid_levels], (err, results) => {
		
		if (err) {
			console.error('Erreur lors de la récupération des decks recherchés :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}
		
		if(results.length > 0){

			return res.status(200).json({ message: '', data:results });
		}
		else {
			return res.status(200).json({ message: 'Aucun deck trouvé' });
		}
	});
});

//Récupération des infos complémentaires d'un deck
app.post('/get_more_about_deck', requireLogin, async (req, res) => {
	const { id } = req.body;
	
	const verif_id = validateUserInput(id, 'name', true);
	if(!verif_id.valid) {
		return res.status(401).json({ message: verif_id.message });
	}
	let valid_id = verif_id.sanitizedInput;
	
	let query = `SELECT COUNT(DISTINCT card.id_card) as nb_cards, COUNT(DISTINCT step.id_step) as nb_steps, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.type, DATE_FORMAT(last_modification, "%d/%m/%Y") AS last_modification, tag.tag, level.level, user.firstname, user.surname
	FROM deck
	INNER JOIN tag ON deck.id_tag = tag.id_tag
	INNER JOIN level ON deck.id_level = level.id_level
	INNER JOIN user ON deck.id_user = user.id_user
	LEFT JOIN card ON deck.id_deck = card.id_deck
	LEFT JOIN step ON deck.id_deck = step.id_deck
	WHERE deck.id_deck = ? AND deck.acces_type = 'PUBLIC'
	GROUP BY deck.id_deck, deck.name, deck.up_vote, deck.down_vote, tag.tag, level.level, user.firstname, user.surname
	`;
	
	db.query(query, [valid_id], (err, deck) => {
		
		if (err) {
			console.error('Erreur lors de la récupération du deck recherché :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		if(deck.length <= 0){
			return res.status(200).json({ message: 'Ce deck n\'existe pas' });
		}

		let queryCards = `
		SELECT id_card, question, answer, img_q, img_a
		FROM card
		WHERE id_deck = ?
		`;
		db.query(queryCards, [deck[0].id_deck], (err, cards) => {
			if (err) {
				console.error('Erreur lors de la récupération des cartes du deck recherché :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			let querySteps = `
			SELECT id_step, title, type
			FROM step
			WHERE id_deck = ?
			`;
			db.query(querySteps, [deck[0].id_deck], (err, steps) => {
				if (err) {
					console.error('Erreur lors de la récupération des cartes du deck recherché :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
				}
		
				return res.status(200).json({ message: '', deck:deck[0], cards:cards, steps:steps });
			});
		});
	});
});

//Recherche d'un deck via son code
app.post('/get_deck_by_code', requireLogin, async (req, res) => {
	const { code } = req.body;
	
	const verif_code = validateUserInput(code, 'name', true);
	if(!verif_code.valid) {
		return res.status(401).json({ message: verif_code.message });
	}
	let valid_code = verif_code.sanitizedInput;

	console.log("Récupération via code")
	
	let query = `SELECT COUNT(DISTINCT card.id_card) as nb_cards, COUNT(DISTINCT step.id_step) as nb_steps, deck.id_deck, deck.name, deck.up_vote, deck.down_vote, deck.type, DATE_FORMAT(last_modification, "%d/%m/%Y") AS last_modification, tag.tag, level.level, user.firstname, user.surname
	FROM deck
	INNER JOIN tag ON deck.id_tag = tag.id_tag
	INNER JOIN level ON deck.id_level = level.id_level
	INNER JOIN user ON deck.id_user = user.id_user
	LEFT JOIN card ON deck.id_deck = card.id_deck
	LEFT JOIN step ON deck.id_deck = step.id_deck
	WHERE deck.code = ?
	GROUP BY deck.id_deck, deck.name, deck.up_vote, deck.down_vote, tag.tag, level.level, user.firstname, user.surname
	`;
	
	db.query(query, [valid_code], (err, deck) => {
		
		if (err) {
			console.error('Erreur lors de la récupération du deck recherché via le code :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		if(deck.length <= 0){
			return res.status(200).json({ message: 'Ce deck n\'existe pas' });
		}

		let queryCards = `
		SELECT id_card, question, answer, img_q, img_a
		FROM card
		WHERE id_deck = ?
		`;
		db.query(queryCards, [deck[0].id_deck], (err, cards) => {
			if (err) {
				console.error('Erreur lors de la récupération des cartes du deck recherché :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			let querySteps = `
			SELECT id_step, title, type
			FROM step
			WHERE id_deck = ?
			`;
			db.query(querySteps, [deck[0].id_deck], (err, steps) => {
				if (err) {
					console.error('Erreur lors de la récupération des cartes du deck recherché :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
				}
		
				return res.status(200).json({ message: '', deck:deck[0], cards:cards, steps:steps });
			});
		});
	});
});

//Déblocage d'un deck
app.post('/unlock_deck', requireLogin, async (req, res) => {
	const { id } = req.body;
	
	const verif_id = validateUserInput(id, 'name', true);
	if(!verif_id.valid) {
		return res.status(401).json({ message: verif_id.message });
	}
	let valid_id = verif_id.sanitizedInput;

	console.log("Unlock du deck : ", valid_id);
	
	// Vérifier si l'utilisateur a déjà déloqué le deck
	//Vérifier si le deck existe 
	const checkconsultQuery = 'SELECT (SELECT COUNT(*) FROM consult WHERE id_deck = ? AND id_user = ?) AS consult_exist, (SELECT COUNT(*) FROM deck WHERE id_deck = ?) AS deck_exist';
	db.query(checkconsultQuery, [valid_id, req.session.userId, valid_id], (err, results) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès à un deck pour le débloquer :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		const consultExists = results[0].consult_exist > 0;
		const deckExists = results[0].deck_exist <= 0;

		if (consultExists) {
			return res.status(409).json({ message: 'Deck déjà débloqué' });
		}

		if (deckExists) {
			return res.status(400).json({ message: 'Deck introuvable' });
		}

		const getCardsQuery = 'SELECT id_card FROM card WHERE id_deck = ?';
		db.query(getCardsQuery, [valid_id], (err, resultsCards) => {
			if (err) {
				console.error('Erreur lors de la récupérations des id des cartes du deck', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			let tabToInsert = [];

			resultsCards.forEach(element => {
				tabToInsert.push([element.id_card, req.session.userId, valid_id]);
			});

			// Insérer l'utilisateur dans la base de données
			const inserconsultQuery = 'INSERT INTO consult (id_deck, id_user) VALUES (?, ?)';
			
			db.query(inserconsultQuery, [valid_id, req.session.userId], (err, results) => {
				if (err) {
					console.error('Erreur lors de l\'insertion du déblocage :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
				}

				if(tabToInsert.length > 0) {
					const insercardsTrainQuery = 'INSERT INTO cards_score (id_card, id_user, id_deck) VALUES ?';
					
					db.query(insercardsTrainQuery, [tabToInsert], (err, results) => {
						if (err) {
							console.error('Erreur lors de l\'insertion des cartes de score :', err);
							return res.status(500).json({ message: 'Erreur serveur' });
						}

					});
				}
				return res.status(201).json({ message: 'Deck débloqué' });
			});

		});
	});
});

//Archivage d'un deck
app.post('/archivage_deck', requireLogin, async (req, res) => {
	const id_deck = req.body.id_deck;

	console.log(req.body);

	const verif_id_deck = validateUserInput(id_deck, 'name', true);
	if (!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	let valid_id_deck = verif_id_deck.sanitizedInput;

	console.log("Archivage du deck : ", valid_id_deck);

	// Vérifier si l'utilisateur a déjà déloqué le deck
	//Vérifier si le deck existe 
	const checkconsultQuery = 'SELECT (SELECT COUNT(*) FROM consult WHERE id_deck = ? AND id_user = ?) AS consult_exist, (SELECT COUNT(*) FROM deck WHERE id_deck = ?) AS deck_exist';
	db.query(checkconsultQuery, [valid_id_deck, req.session.userId, valid_id_deck], (err, results) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès à un deck pour le débloquer :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		if (results[0].consult_exist <= 0 || results[0].deck_exist <= 0) {
			return res.status(409).json({ message: 'Accès non valide' });
		}

		const archivageQuery = 'UPDATE consult SET archive = 1 WHERE id_deck = ? && id_user = ?';
		db.query(archivageQuery, [valid_id_deck, req.session.userId], (err, results) => {
			if (err) {
				console.error('Erreur lors de l\'archivage du deck :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}
			return res.status(201).json({ message: 'Deck archivé' });
		});
	});
});

//Désarchivage d'un deck
app.post('/desarchivage_deck', requireLogin, async (req, res) => {
	const id_deck = req.body.id_deck;

	console.log(req.body);

	const verif_id_deck = validateUserInput(id_deck, 'name', true);
	if (!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	let valid_id_deck = verif_id_deck.sanitizedInput;

	console.log("Archivage du deck : ", valid_id_deck);

	// Vérifier si l'utilisateur a déjà déloqué le deck
	//Vérifier si le deck existe 
	const checkconsultQuery = 'SELECT (SELECT COUNT(*) FROM consult WHERE id_deck = ? AND id_user = ? AND archive = 1) AS consult_archive_exist, (SELECT COUNT(*) FROM deck WHERE id_deck = ?) AS deck_exist';
	db.query(checkconsultQuery, [valid_id_deck, req.session.userId, valid_id_deck], (err, results) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès à un deck pour le débloquer :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		if (results[0].consult_archive_exist <= 0 || results[0].deck_exist <= 0) {
			return res.status(409).json({ message: 'Accès non valide' });
		}

		const archivageQuery = 'UPDATE consult SET archive = 0 WHERE id_deck = ? && id_user = ?';
		db.query(archivageQuery, [valid_id_deck, req.session.userId], (err, results) => {
			if (err) {
				console.error('Erreur lors de l\'archivage du deck :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}
			return res.status(201).json({ message: 'Deck archivé', deck:valid_id_deck });
		});
	});
});


//Setting up train
app.post('/setting_train', requireLogin, async (req, res) => {

	const { id_deck, nb_cards, reverse_side } = req.body;
	
	const verif_id_deck = validateUserInput(id_deck, 'name', false);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	let valid_id_deck = verif_id_deck.sanitizedInput;
	
	const verif_nb_cards = validateUserInput(nb_cards, 'name', false);
	if(!verif_nb_cards.valid) {
		return res.status(401).json({ message: verif_nb_cards.message });
	}
	let valid_nb_cards = verif_nb_cards.sanitizedInput;
	
	const verif_reverse_side = validateUserInput(reverse_side, 'name', false);
	if(!verif_reverse_side.valid) {
		return res.status(401).json({ message: verif_reverse_side.message });
	}
	let valid_reverse_side = verif_reverse_side.sanitizedInput;

	if(valid_nb_cards <= 0 || valid_nb_cards > 20) {
		return res.status(401).json({ message: 'Nombre de cartes invalide' });
	}

	if(valid_reverse_side != 0 && valid_reverse_side != 1) {
		return res.status(401).json({ message: 'Valeur invalide' });
	}

	//On vérifie que le deck existe, que l'utilisateur consult le deck et que la carte existe dans le deck
	const query='SELECT (SELECT COUNT(*) FROM consult WHERE id_deck = ? AND id_user = ?) AS consult_exist, (SELECT COUNT(*) FROM deck WHERE id_deck = ?) AS deck_exist'
	db.query(query, [valid_id_deck, req.session.userId, valid_id_deck], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès au deck :', err);
			return;
		}

		if(rows[0].consult_exist <= 0 || rows[0].deck_exist <= 0 || rows[0].card_exist <= 0) {
			return res.status(401).json({ message: 'Erreur d\'accès' });
		}

		const updateScoreQuery = 'UPDATE consult SET nb_card_by_train = ?, reverse_side = ? WHERE id_deck = ? && id_user = ?';
		db.query(updateScoreQuery, [valid_nb_cards, valid_reverse_side, valid_id_deck, req.session.userId], (err, results3) => {
			if (err) {
				console.error('Erreur lors de l\'modification du score :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}

			return res.status(201).json({ message: 'Paramètres enregistrés' });
		});
	});
		
});

//Evaluation d'une carte
app.post('/eval_card', requireLogin, async (req, res) => {

	const { id_deck, id_card, note } = req.body;
	
	const verif_id_deck = validateUserInput(id_deck, 'name', false);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	let valid_id_deck = verif_id_deck.sanitizedInput;
	
	const verif_id_card = validateUserInput(id_card, 'name', false);
	if(!verif_id_card.valid) {
		return res.status(401).json({ message: verif_id_card.message });
	}
	let valid_id_card = verif_id_card.sanitizedInput;
	
	const verif_note = validateUserInput(note, 'name', false);
	if(!verif_note.valid) {
		return res.status(401).json({ message: verif_note.message });
	}
	let valid_note = verif_note.sanitizedInput;
	
	if(!req.session.idTrain) {
		return res.status(401).json({ message: verif_note.message });
	}

	//On vérifie que le deck existe, que l'utilisateur consult le deck et que la carte existe dans le deck
	const query='SELECT (SELECT COUNT(*) FROM consult WHERE id_deck = ? AND id_user = ?) AS consult_exist, (SELECT COUNT(*) FROM deck WHERE id_deck = ?) AS deck_exist, (SELECT COUNT(*) FROM card WHERE id_deck = ? AND id_card = ?) AS card_exist'
	db.query(query, [valid_id_deck, req.session.userId, valid_id_deck, valid_id_deck, valid_id_card], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès au deck :', err);
			return;
		}

		if(rows[0].consult_exist <= 0 || rows[0].deck_exist <= 0 || rows[0].card_exist <= 0) {
			return res.status(401).json({ message: 'Erreur d\'accès' });
		}


		const selectCardsScoreQuery = 'SELECT score FROM train WHERE id_card = ? && id_user = ? ORDER BY id_train DESC LIMIT 1';
		db.query(selectCardsScoreQuery, [valid_id_card, req.session.userId], (err, results1) => {
			if (err) {
				console.error('Erreur lors de la récupération du dernier score :', err);

				return res.status(500).json({ message: 'Erreur serveur' });
			}

			let newScore;
			if(!results1 || results1.length <= 0) {
				newScore = note;
			}
			else {
				newScore = Math.round((parseInt(results1[0].score) + parseInt(note))/2);
			}

				//On vérifie que la carte a pas encore été répondu pour éviter le spam
				const selectCardsScoreQuery = 'SELECT COUNT(*) as exist FROM train WHERE id_card = ? && id_user = ? && session = ?';
				db.query(selectCardsScoreQuery, [valid_id_card, req.session.userId, req.session.idTrain], (err, results_spam) => {
					if (err) {
						console.error('Erreur lors de la vérification du spam :', err);

						return res.status(500).json({ message: 'Erreur serveur' });
					}

					if(results_spam && results_spam[0].exist > 0) {
						return res.status(401).json({ message: 'Vous avez déjà répondu à cette carte pendant la session actuelle' });
					}

			
				const insertUserQuery = 'INSERT INTO train (id_card, id_user, id_deck, score, session) VALUES (?, ?, ?, ?, ?)';
				db.query(insertUserQuery, [valid_id_card, req.session.userId, valid_id_deck, valid_note, req.session.idTrain], (err, results2) => {
					if (err) {
						console.error('Erreur lors de l\'insertion de l\'entrainement :', err);

						return res.status(500).json({ message: 'Erreur serveur' });
					}

					const updateScoreQuery = 'UPDATE cards_score SET score = ? WHERE id_card = ? && id_user = ? && id_deck = ?';
					db.query(updateScoreQuery, [newScore, valid_id_card, req.session.userId, valid_id_deck], (err, results3) => {
						if (err) {
							console.error('Erreur lors de l\'modification du score :', err);
							return res.status(500).json({ message: 'Erreur serveur' });
						}

						return res.status(201).json({ message: 'Note enregistrée' });
					});
				});
				
			});
		});
	});
		
});

//Vote
app.post('/vote_update', requireLogin, async (req, res) => {
	const body_ = req.body;
	
	const id_deck = parseInt(body_.iddeck);
	const type = body_.type;

	//On vérifie que l'ID entré est bien un nombre
	if (isNaN(id_deck) | ( (type !== 'UP') && (type !== 'DOWN') )) {
		return res.status(401).json({ message: 'Vote non valide' });
	}
	else {
		//L'utilisateur consulte bien le deck
		let query_verif = `SELECT id_consult FROM consult WHERE id_user = ? AND id_deck = ?`;
		db.query(query_verif, [req.session.userId,id_deck], (err, results) => {
			if (err) {
				console.error('Erreur lors de la vérification de l\'accès au deck :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}
			if(results.length > 0){
				/* RECUP du nb de votes */
				let query = `SELECT up_vote,down_vote FROM deck WHERE deck.id_deck = ?`;
				db.query(query, [id_deck], (err, results) => {
					if (err) {
						console.error('Erreur lors de la récupération du nombre de votes :', err);
						return res.status(500).json({ message: 'Erreur serveur' });
					}
					if(results.length > 0){
						/* MODIF du nombre de votes */
						let nb_votes_up = parseInt(results[0].up_vote);
						let nb_votes_down = parseInt(results[0].down_vote);

						let vote = type;

						//Si l'utilisateur a vote
						let query_vote_verif = `SELECT vote FROM vote WHERE id_user = ? AND id_deck = ?`;
						db.query(query_vote_verif, [req.session.userId,id_deck], (err, results) => {
							if (err) {
								console.error('Erreur lors de la vérification du vote de l\'utilisateur :', err);
								return res.status(500).json({ message: 'Erreur serveur' });
							}
							//L'utilisateur a deja vote pour ce deck
							if(results.length > 0){
								let db_vote = results[0].vote;

								//Le vote est le meme donc on le supprime
								if (db_vote == vote) {
									
									//On supprime le vote de l'utilisateur dans la BDD de vote
									let query_delete_vote = `DELETE FROM vote WHERE id_user = ? AND id_deck = ?`;
									db.query(query_delete_vote, [req.session.userId,id_deck], (err, results) => {
										if (err) {
											console.error('Erreur lors de la suppression du dernier vote :', err);
											return res.status(500).json({ message: 'Erreur serveur' });
										}
										if(results.affectedRows > 0){
											
											//On supprime son vote
											if (vote == 'DOWN') {
												nb_votes_down--;
											} else if (vote == 'UP') {
												nb_votes_up--;
											}

											let same = true;

											//Update dans la BDD et pour le client
											let query_update = `UPDATE deck SET up_vote = ?, down_vote = ? WHERE id_deck = ?`;
											db.query(query_update, [nb_votes_up,nb_votes_down,id_deck], (err, results) => {if (err) {console.error('Erreur lors de la suppression du vote sur le deck :', err);return res.status(500).json({ message: 'Erreur serveur' });}if(results.affectedRows > 0){return res.status(200).json({ message: 'Vote supprimé avec succèes', nb_votes_up, nb_votes_down,same });}else {return res.status(200).json({ message: 'Erreur lors de la suppression du vote' });}});	
										}
										else {
											return res.status(200).json({ message: 'Erreur lors de la suppression du vote' });
										}
									});
								}
								if ((db_vote == 'UP') && (vote == 'DOWN')) {
									nb_votes_up--;
									nb_votes_down++;

									//On modifie le vote de l'utilisateur
									let query_update_vote = `UPDATE vote SET vote = ? WHERE id_user = ? AND id_deck = ?`;
									db.query(query_update_vote, [vote,req.session.userId,id_deck], (err, results) => {
										if (err) {
											console.error('Erreur lors de la modification du vote :', err);
											return res.status(500).json({ message: 'Erreur serveur' });
										}
										if(results.affectedRows > 0){
											
											//Update dans la BDD et pour le client
											let query_update = `UPDATE deck SET up_vote = ?, down_vote = ? WHERE id_deck = ?`;
											db.query(query_update, [nb_votes_up,nb_votes_down,id_deck], (err, results) => {if (err) {console.error('Erreur lors de la modification du vote sur le deck :', err);return res.status(500).json({ message: 'Erreur serveur' });}if(results.affectedRows > 0){return res.status(200).json({ message: 'Vote modifié avec succèes', nb_votes_up, nb_votes_down });}else {return res.status(200).json({ message: 'Erreur lors de la modification du vote' });}});	
										}
										else {
											return res.status(200).json({ message: 'Erreur lors de la modification du vote' });
										}
									});
								}
								else if ((db_vote == 'DOWN') && (vote == 'UP')) {
									nb_votes_up++;
									nb_votes_down--;
								
									//On modifie le vote de l'utilisateur
									let query_update_vote = `UPDATE vote SET vote = ? WHERE id_user = ? AND id_deck = ?`;
									db.query(query_update_vote, [vote,req.session.userId,id_deck], (err, results) => {
										if (err) {
											console.error('Erreur lors de la modification du vote :', err);
											return res.status(500).json({ message: 'Erreur serveur' });
										}
										if(results.affectedRows > 0){
											
											//Update dans la BDD et pour le client
											let query_update = `UPDATE deck SET up_vote = ?, down_vote = ? WHERE id_deck = ?`;
											db.query(query_update, [nb_votes_up,nb_votes_down,id_deck], (err, results) => {if (err) {console.error('Erreur lors de la modification du vote sur le deck :', err);return res.status(500).json({ message: 'Erreur serveur' });}if(results.affectedRows > 0){return res.status(200).json({ message: 'Vote modifié avec succèes', nb_votes_up, nb_votes_down });}else {return res.status(200).json({ message: 'Erreur lors de la modification du vote' });}});	
										}
										else {
											return res.status(200).json({ message: 'Erreur lors de la modification du vote' });
										}
									});
								}
							}

							//L'utilisateur n'a jamais voté pour ce deck donc on créé un vote
							else {
								let query_ajout = `INSERT INTO vote (id_user, id_deck, vote) VALUES (?,?,?)`;
								db.query(query_ajout, [req.session.userId,id_deck,vote], (err, results) => {
									if (err) {
										console.error('Erreur lors de l\'ajout du vote :', err);
										return res.status(500).json({ message: 'Erreur serveur' });
									}
									else {
										console.log("Creation vote");
										if (vote == 'DOWN') {	
											nb_votes_down++;
											
											//Update dans la BDD et pour le client
											let query_update = `UPDATE deck SET up_vote = ?, down_vote = ? WHERE id_deck = ?`;
											db.query(query_update, [nb_votes_up,nb_votes_down,id_deck], (err, results) => {if (err) {console.error('Erreur lors de l\'ajout du vote sur le deck :', err);return res.status(500).json({ message: 'Erreur serveur' });}if(results.affectedRows > 0){return res.status(200).json({ message: 'Vote enregistré avec succèes', nb_votes_up, nb_votes_down });}else {return res.status(200).json({ message: 'Erreur lors du vote' });}});
										}
										else {
											nb_votes_up++;
											
											//Update dans la BDD et pour le client
											let query_update = `UPDATE deck SET up_vote = ?, down_vote = ? WHERE id_deck = ?`;
											db.query(query_update, [nb_votes_up,nb_votes_down,id_deck], (err, results) => {if (err) {console.error('Erreur lors de l\'ajout du vote sur le deck :', err);return res.status(500).json({ message: 'Erreur serveur' });}if(results.affectedRows > 0){return res.status(200).json({ message: 'Vote enregistré avec succèes', nb_votes_up, nb_votes_down });}else {return res.status(200).json({ message: 'Erreur lors du vote' });}});
										}
									}
								});
							}
						});
				
					}
					else {
						return res.status(200).json({ message: 'Ce deck n\'existe pas' });
					}
				});
			}
			else {
				return res.status(200).json({ message: 'Vous n\'avez pas accès à ce deck' });
			}
		});
	}
});

//Récupération du vote d'un utilisateur
app.post('/user_voted', requireLogin, async (req, res) => {
	const body_ = req.body;
	
	const id_deck = parseInt(body_.iddeck);

	//On vérifie que l'ID entrée est bien un nombre
	if (isNaN(id_deck)) {
		return res.status(401).json({ message: 'Vote non valide' });
	}
	else {
		//L'utilisateur consulte bien le deck
		let query_verif = `SELECT id_consult FROM consult WHERE id_user = ? AND id_deck = ?`;
		db.query(query_verif, [req.session.userId,id_deck], (err, results) => {
			if (err) {
				console.error('Erreur lors de la vérification de l\'accès au deck :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}
			if(results.length > 0){
				
				//Si l'utilisateur a vote
				let query_vote_verif = `SELECT vote FROM vote WHERE id_user = ? AND id_deck = ?`;
				db.query(query_vote_verif, [req.session.userId,id_deck], (err, results) => {
					if (err) {
						console.error('Erreur lors de la récupération des votes du deck :', err);
						return res.status(500).json({ message: 'Erreur serveur' });
					}
					if(results.length > 0){
						let vote_type = results[0].vote;
						return res.status(200).json({ message: '', vote_type });					
					}
					else {
						return res.status(200).json({ message: 'Pas de vote' });
					}
				});
			}
			else {
				return res.status(200).json({ message: 'Vous n\'avez pas accès à ce deck' });
			}
		});
	}
});





//Ajout d'un parcours
app.post('/add_parcours', requireLogin, uploadMix.any(), async (req, res) => {
	const title = req.body.title;
	const desc = req.body.desc;
	
	const files = req.files;

	const parcours = JSON.parse(req.body.parcours)

	if(!parcours.length) {
		return res.status(401).json({ message: 'Parcours vide' });
	}
	if(parcours.length <= 0) {
		return res.status(401).json({ message: 'Parcours vide' });
	}

	let counterFile = 0
	parcours.forEach(element => {
		if(element.type == "IMG" || element.type == "PDF")counterFile++;
		if(element.type == "CARDS") {
			element.content.forEach(cards => {
				if(cards.img_q)counterFile++;
				if(cards.img_r)counterFile++;
			})
		}
	});

	if(counterFile != files.length) {
		files.forEach((file) => {
			fs.unlinkSync(file.path);
		});
		return res.status(401).json({ message: 'Le nombre de fichiers n\'est pas correct' });
	}

	let photosNameValidity = true;
	files.forEach(async (elem) => {
		if(elem.fieldname != "file"){
			photosNameValidity = false
		}
	})
	if(!photosNameValidity)return res.status(401).json({ message: "Noms de fichiers invalides" });

	let errorFormat = false;
	let error = "Erreur de format"
	parcours.forEach(elem => {
		if(!elem.type || !elem.name || !elem.content)return res.status(401).json({ message: 'Format non valide' });
		if(elem.type != "VOD" && elem.type != "IMG" && elem.type != "PDF" && elem.type != "FICHE" && elem.type != "CARDS") {
			errorFormat = true;
			error = "Type d'item non valide";
		}
		const verif_elem_type = validateUserInput(elem.type, 'name', true);
		if(!verif_elem_type.valid) {
			errorFormat = true;
			error = verif_elem_type.message;
		}
		const verif_elem_name = validateUserInput(elem.name, 'name', true);
		if(!verif_elem_name.valid) {
			errorFormat = true;
			error = verif_elem_name.message;
		}
		if(elem.type != "CARDS" && elem.type != "FICHE" && elem.type != "VOD") {
			const verif_elem_content = validateUserInput(elem.content, 'name', true);
			if(!verif_elem_content.valid) {
				errorFormat = true;
				error = verif_elem_content.message;
			}
		}
		else if(elem.type == "CARDS") {
			let cards = elem.content
			if(!cards.length || cards.length <= 0) {
				errorFormat = true;
				error = 'Cartes vides';
			}
			cards.forEach(card => {
				if(!card.q || !card.r) {
					errorFormat = true;
					error = 'Format des questions non valide';
				}
			})
		}
		else if(elem.type == "VOD") {
			const url = elem.content;
			if(!url.startsWith("https://www.youtube.com/embed/") && !url.startsWith("https://www.dailymotion.com/embed/video/") && !url.startsWith("https://player.vimeo.com/video/")) {
				errorFormat = true;
				error = 'URL de la vidéo non valide';
			}
		}
		else {
			elem.content = JSON.stringify(elem.content)
		}
	});
	if(errorFormat) {
		files.forEach((file) => {
			fs.unlinkSync(file.path);
		});
		return res.status(401).json({ message: error });
	}

	let filesUploaded = [];
	let fileIndex = 0;

	// Compression des images
	const compressedFiles = await Promise.all(
		files.map(async (file) => {
			if(path.extname(file.originalname) != ".pdf") {
				const compressedImage = await sharp(file.path)
					.toFormat('jpeg')
					.jpeg({ quality: 10 })
					.toBuffer()

				return {
					originalName: file.originalname,
					name:file.fieldname,
					title:file.filename,
					buffer: compressedImage
				};
			}
			else {
				return {
					originalName: file.originalname,
					title:file.filename,
					name:file.fieldname
				};
			}
		})
	);

	let errorWhileReUpload = false;
	// Enregistrez les images dans la limite de taille
	compressedFiles.forEach(async (file) => {
		// Générez un nom de fichier unique, par exemple en utilisant un horodatage ou un identifiant unique
		let newName = file.title;
		if(path.extname(file.title) != ".pdf") {
			newName = Date.now()+'-'+randTmp()+'-fichier.jpeg';
		}
		const destinationPath = 'front/uploads/'+newName;
		filesUploaded.push({
			name:newName
		});

		if(path.extname(file.title) != ".pdf") {
			fs.writeFile(destinationPath, file.buffer, (err) => {
				if (err) {
					console.error('Erreur lors de l\'enregistrement de l\'image :', err);
					errorWhileReUpload = true;
					res.status(401).json({ message: "Erreur serveur lors de l'enregistrement des images" });
					// Gérez l'erreur (par exemple, renvoyer une réponse d'erreur appropriée au client)
				} else {
					console.log('Image enregistrée avec succès :', destinationPath);
					// Effectuez d'autres actions si nécessaire (par exemple, stockez le chemin de l'image dans une base de données)
				}
			});
		}
	});

	// Supprimez les fichiers téléchargés du système de fichiers
	files.forEach((file) => {
		if(path.extname(file.filename) != ".pdf") {
			fs.unlinkSync(file.path);
		}
	});

	if(errorWhileReUpload)return res.status(401).json({ message: "Erreur serveur" });

	

	// Insérer le deck dans la base de données
	const insertUserQuery = 'INSERT INTO deck (id_user, name, description, type) VALUES (?, ?, ?, "PARCOURS")';
	db.query(insertUserQuery, [req.session.userId, title, desc], (err, results) => {
		if (err) {
			console.error('Erreur lors de l\'insertion du deck :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}

		let count = 0;
		parcours.forEach(elem => {
			let content = elem.content;
			if(elem.type == "PDF" || elem.type == "IMG") {
				content = filesUploaded[fileIndex++].name;
			}
			if(elem.type == "CARDS") {
				content = "CARDS"
			}
			const insertUserQuery = 'INSERT INTO step (id_deck, type, title, content, step_order) VALUES (?, ?, ?, ?, ?)';
			db.query(insertUserQuery, [results.insertId, elem.type, elem.name, content, count++], (err, results2) => {
				if (err) {
					console.error('Erreur lors de l\'insertion des cartes :', err);

					//Suppression du deck et des cartes si erreur

					return res.status(500).json({ message: 'Erreur serveur' });
				}

				if(elem.type == "CARDS") {
					elem.content.forEach(card => {
						let img_q = card.img_q ? (filesUploaded[fileIndex++]).name : "";
						let img_a = card.img_r ? (filesUploaded[fileIndex++]).name : "";
						// Insérer les cartes
						const insertCardsQuery = 'INSERT INTO card (id_deck, question, answer, img_q, img_a, id_step) VALUES (?, ?, ?, ?, ?, ?)';
						db.query(insertCardsQuery, [results.insertId, card.q, card.r, img_q, img_a, results2.insertId], (err, results3) => {
							if (err) {
								console.error('Erreur lors de l\'insertion des nouvelles cartes du parcours :', err);
	
								return res.status(500).json({ message: 'Erreur serveur' });
							}
	
						});
					})
				}
			});

			
		});

		return res.status(201).json({ message: 'Registration succeeded', id:results.insertId });
	});
});

//Déverrouillage d'une étape
app.post('/unlock_step', requireLogin, async (req, res) => {

	const { id_deck, id_step } = req.body;
	
	const verif_id_deck = validateUserInput(id_deck, 'name', false);
	if(!verif_id_deck.valid) {
		return res.status(401).json({ message: verif_id_deck.message });
	}
	let valid_id_deck = verif_id_deck.sanitizedInput;
	
	const verif_id_step = validateUserInput(id_step, 'name', false);
	if(!verif_id_step.valid) {
		return res.status(401).json({ message: verif_id_step.message });
	}
	let valid_id_step = verif_id_step.sanitizedInput;
	
	//On vérifie que le deck existe, que l'utilisateur consult le deck et que le step existe dans le deck
	const query='SELECT (SELECT COUNT(*) FROM consult WHERE id_deck = ? AND id_user = ?) AS consult_exist, (SELECT COUNT(*) FROM deck WHERE id_deck = ?) AS deck_exist, (SELECT COUNT(*) FROM step WHERE id_deck = ? AND id_step = ?) AS step_exist'
	db.query(query, [valid_id_deck, req.session.userId, valid_id_deck, valid_id_deck, valid_id_step], (err, rows) => {
		if (err) {
			console.error('Erreur lors de la vérification de l\'accès au deck :', err);
			return;
		}

		if(rows[0].consult_exist <= 0 || rows[0].deck_exist <= 0 || rows[0].step_exist <= 0) {
			return res.status(401).json({ message: 'Erreur d\'accès' });
		}


		const selectCardsScoreQuery = 'SELECT step_order FROM step WHERE id_step = ? && id_deck = ?';
		db.query(selectCardsScoreQuery, [valid_id_step, valid_id_deck], (err, step) => {
			if (err) {
				console.error('Erreur lors de la récupération du dernier score :', err);

				return res.status(500).json({ message: 'Erreur serveur' });
			}

			if(!step || step.length <= 0) {
				return res.status(401).json({ message: 'Erreur d\'accès' });
			}

			//On vérifie que la carte a pas encore été répondu pour éviter le spam
			const selectCardsScoreQuery = 'SELECT COUNT(*) as exist FROM consult WHERE id_user = ? && id_deck = ? && step = ?';
			db.query(selectCardsScoreQuery, [req.session.userId, valid_id_deck, step[0].step_order], (err, next) => {
				if (err) {
					console.error('Erreur lors de la vérification du spam :', err);

					return res.status(500).json({ message: 'Erreur serveur' });
				}

				if(!next || next[0].exist <= 0) {
					return //res.status(200).json({ message: 'Vous ne pouvez pas débloquer cette étape' });
				}

				const updateScoreQuery = 'UPDATE consult SET step = step +1 WHERE id_deck = ? && id_user = ?';
				db.query(updateScoreQuery, [valid_id_deck, req.session.userId], (err, results3) => {
					if (err) {
						console.error('Erreur lors du déblocage de l\'étape suivante :', err);
						return res.status(500).json({ message: 'Erreur serveur' });
					}

					return res.status(201).json({ message: 'Etape suivante débloquée' });
				});
			});
		});
	});
		
});



//Modification du mot de passe
app.post('/edit_user_data', requireLogin, async (req, res) => {
	const body_ = req.body;
	
	const pass = body_.pass;

	const verif_old_password = validateUserInput(pass.old_pass, 'password', true);
	if(!verif_old_password.valid) {
		return res.status(401).json({ message: verif_old_password.message });
	}
	const valid_old_password = verif_old_password.sanitizedInput;

	const verif_new_password = validateUserInput(pass.new_pass, 'password', true);
	if(!verif_new_password.valid) {
		return res.status(401).json({ message: verif_new_password.message });
	}
	const valid_new_password = verif_new_password.sanitizedInput;

	const verif_conf_new_password = validateUserInput(pass.conf_new_pass, 'password', true);
	if(!verif_conf_new_password.valid) {
		return res.status(401).json({ message: verif_old_password.message });
	}
	const valid_conf_new_password = verif_conf_new_password.sanitizedInput;

	// Vérifier si l'utilisateur existe dans la base de données
	const getUserQuery = 'SELECT * FROM user WHERE id_user = ?';
	db.query(getUserQuery,[req.session.userId], (err, results) => {
		if (err) {
			console.error('Erreur lors de la récupération de l\'utilisateur :', err);
			return res.status(500).json({ message: 'Erreur serveur' });
		}
		if (results.length === 0) {
			return res.status(500).json({ message: 'Utilisateur non trouvé' });
		}
	
		const user = results[0];
	
		// Vérifier le mot de passe
		bcrypt.compare(valid_old_password, user.password, (err, isMatch) => {
			if (err) {
				console.error('Erreur lors de la comparaison des mots de passe :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}
	
			if (!isMatch) {
				return res.status(500).json({ message: 'Mot de passe incorrect' });
			}
			

			if (valid_new_password == valid_conf_new_password) {

				// Insérer l'utilisateur dans la base de données
				const editUserQuery = 'UPDATE user SET password = ? WHERE id_user = ?';
				bcrypt.hash(valid_new_password, saltRounds, (err, hash) => {
					if (err) {
					console.error('Erreur lors du hachage du mot de passe :', err);
					return res.status(500).json({ message: 'Erreur serveur' });
					}
				
					db.query(editUserQuery, [hash,req.session.userId], (err, results) => {
						if (err) {
							console.error('Erreur lors de l\'insertion de l\'utilisateur :', err);
							return res.status(500).json({ message: 'Erreur serveur' });
						}
		
						let ok = true;
						return res.status(201).json({ message: 'Le mot de passe a bien été changé', valid:true });
					});
				});
			}
			else {
				return res.status(500).json({ message: 'Les nouveaux mots de passe sont différents' });			
			}

		});
	});
});

//Bloquer un deck
app.post('/block_deck', requireLogin, async (req, res) => {
	/*const body_ = req.body;
	
	const id_deck = parseInt(body_.iddeck);

	//On vérifie que l'ID entrée est bien un nombre
	if (isNaN(id_deck)) {
		return res.status(401).json({ message: 'Erreur ID' });
	}
	else {
		//L'utilisateur consulte bien le deck
		let query_verif = `SELECT id_consult FROM consult WHERE id_user = ? AND id_deck = ?`;
		db.query(query_verif, [req.session.userId,id_deck], (err, results) => {
			if (err) {
				console.error('Erreur lors de la vérification de l\'accès au deck :', err);
				return res.status(500).json({ message: 'Erreur serveur' });
			}
			if(results.length > 0){
				let query_del = `DELETE FROM consult WHERE id_user = ? AND id_deck = ?`;
				db.query(query_del, [req.session.userId,id_deck], (err, results) => {
					if (err) {
						return res.status(500).json({ message: 'Erreur serveur' });
					}
					let ok = true;
					return res.status(201).json({ message: 'Deck bloqué', valid:true });
				});
			}
			else {
				return res.status(200).json({ message: 'Vous n\'avez pas accès à ce deck' });
			}
		});
	}*/
	return res.status(200).json({ message: 'Vous n\'avez pas accès à ce deck' });
});

//Les sockets
io.on('connection', (socket) => {

	
});


const ip = '::';
const port = process.env.PORT;

http.listen(port, () => {
  console.log(`Server listening on ${ip}:${port}`);
});