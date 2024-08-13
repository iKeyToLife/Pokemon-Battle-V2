const router = require('express').Router();
const { withAuth } = require('../utils/auth');
const { fetchPokemonByName, fetchRandomPokemon, fetchBalancedPokemonByName } = require('../utils/pokemonFetch')
const { User, Pokemon, PokemonStats, PokemonAbility, Ability, PokemonLevel } = require('../models');
const BattlePokemon = require('../utils/BattlePokemon');

// Fetch and display a random Pokémon when the battle starts
router.get('/', withAuth, async (req, res) => {
    try {
        const randomPokemon = await fetchRandomPokemon();

        // Fetch user Pokémon
        const userData = await User.findByPk(req.session.user_id, {
            attributes: { exclude: ['password'] },
            raw: true
        });

        const pokemonData = await Pokemon.findAll({
            where: { user_id: userData.id },
            include: [
                { model: PokemonStats },
                { model: Ability, through: PokemonAbility }
            ],
        });

        const convertPokemonData = pokemonData.map(pokemon => pokemon.get({ plain: true }));

        res.render('battle', {
            randomPokemon: randomPokemon,
            gallery: convertPokemonData
        });
    } catch (err) {
        console.error('Error fetching random Pokémon:', err);
        res.status(500).json(err);
    }
});

router.get('/startBattle', withAuth, (req, res) => {
    if (req.session.battleState) {
        const { userPokemon, opponentPokemon, levelData } = req.session.battleState;
        res.render('startBattle', {
            userPokemon,
            opponentPokemon,
            levelData
        });
    } else {
        res.redirect('/battle');
    }
});


// Handle starting the battle with the selected Pokémon
router.post('/startBattle', withAuth, async (req, res) => {
    try {
        const { pokemon_id, opponent_pokemon } = req.body;

        // Fetch the selected user Pokémon from the database
        const userPokemonData = await Pokemon.findOne({
            where: { id: pokemon_id, user_id: req.session.user_id },
            include: [
                { model: PokemonStats },
                { model: Ability, through: PokemonAbility },
                { model: PokemonLevel }
            ],
        });

        if (!userPokemonData) {
            throw new Error('User Pokémon not found.');
        }

        // Extract the user's Pokémon level
        const userPokemon = userPokemonData.get({ plain: true });
        const userPokemonLevel = userPokemon.pokemon_level.level;

        // Fetch the opponent Pokémon using the name (unbalanced)
        const opponentPokemonRaw = await fetchPokemonByName(opponent_pokemon.name);

        // Balance the opponent Pokémon stats based on the user's Pokémon level
        const opponentPokemon = await fetchBalancedPokemonByName(opponent_pokemon.name, userPokemonLevel);

        // Randomly assign an ability to the opponent Pokémon
        const abilitiesData = await Ability.findAll();
        const randomIndex = Math.floor(Math.random() * abilitiesData.length);
        const randomAbility = abilitiesData[randomIndex];

        // Add the random ability to the opponent Pokémon
        opponentPokemon.abilities = [randomAbility.dataValues];

        // Determine who goes first based on speed
        const userTurn = userPokemon.pokemon_stat.speed >= opponentPokemon.speed;

        // Fetch all level data (for potential future use)
        const levelData = await PokemonLevel.findAll({ raw: true });

        // Store the battle state in the session (for use during the battle)
        req.session.battleState = {
            userPokemon: userPokemon,
            opponentPokemon: opponentPokemon,
            opponentPokemonRaw: opponentPokemonRaw,  // Store raw data for future reference
            levelData: levelData,
            userTurn: userTurn
        };

        // Render the start-battle view with both Pokémon
        res.render('startBattle', {
            userPokemon: userPokemon,
            opponentPokemon: opponentPokemon,
            levelData: levelData
        });
    } catch (err) {
        console.error('Error in /battle/startBattle:', err);
        res.status(500).json(err);
    }
});

// test code, delete after verification

router.post('/', async (req, res) => {
    try {
        const { pokemon_id, opponent_pokemon } = req.body;
        console.log(1, pokemon_id, opponent_pokemon, '------------------')

        // Fetch the selected user Pokémon from the database
        const userPokemonData = await Pokemon.findOne({
            where: { id: pokemon_id, user_id: req.session.user_id },
            include: [
                { model: PokemonStats },
                { model: Ability, through: PokemonAbility },
                { model: PokemonLevel }
            ],
        });

        if (!userPokemonData) {
            throw new Error('User Pokémon not found.');
        }

        // Extract the user's Pokémon level
        const userPokemon = userPokemonData.get({ plain: true });
        const userPokemonLevel = userPokemon.pokemon_level.level;

        // Fetch the opponent Pokémon using the name (unbalanced)
        const opponentPokemonRaw = await fetchPokemonByName(opponent_pokemon);

        // Balance the opponent Pokémon stats based on the user's Pokémon level
        const opponentPokemon = await fetchBalancedPokemonByName(opponent_pokemon, userPokemonLevel);

        // Randomly assign an ability to the opponent Pokémon
        const abilitiesData = await Ability.findAll();
        const randomIndex = Math.floor(Math.random() * abilitiesData.length);
        const randomAbility = abilitiesData[randomIndex];
        
        // Add the random ability to the opponent Pokémon
        opponentPokemon.abilities = [randomAbility.dataValues];
        const opponentBattlePokemon = new BattlePokemon(opponentPokemon)
        console.log(opponentBattlePokemon)
        opponentBattlePokemon.triggerAbility()
        console.log(opponentBattlePokemon)

        // Add abilities to user Pokemon
        const formattedUserPokemon = await userPokemonData.getBattleData()
        const userBattlePokemon = new BattlePokemon(formattedUserPokemon)
        console.log(userBattlePokemon)
        userBattlePokemon.triggerAbility()
        console.log(userBattlePokemon)
        
        // Determine who goes first based on speed
        const userTurn = userPokemon.pokemon_stat.speed >= opponentPokemon.speed;

        // Fetch all level data (for potential future use)
        const levelData = await PokemonLevel.findAll({ raw: true });

        // Store the battle state in the session (for use during the battle)
        req.session.battleState = {
            userPokemon: userPokemon,
            opponentPokemon: opponentPokemon,
            opponentPokemonRaw: opponentPokemonRaw,  // Store raw data for future reference
            levelData: levelData,
            userTurn: userTurn,
            // triggerAbility: triggerAbility
        };

        // Render the start-battle view with both Pokémon
        res.render('startBattle', {
            userPokemon: userPokemon,
            opponentPokemon: opponentPokemon,
            levelData: levelData,
            // triggerAbility: triggerAbility
        });
    } catch (err) {
        console.error('Error in /battle/startBattle:', err);
        res.status(500).json(err);
    }
})

// end test code

module.exports = router;