const fs = require('fs');



/**
 * Calculates and returns homewin/draw expectancy, given two Teams
 * @param casa : home Team
 * @param fora : away Team
 * @returns [ float, float, float]
 */
function expectancy(casa, fora) {
	const DIVISOR_ELO = 400.0
	const deltaRating = casa + 100 - fora;
	const divisor = 1 + Math.pow(10, -deltaRating / DIVISOR_ELO) + Math.pow(10, deltaRating / DIVISOR_ELO);
	let win = Math.pow(10, deltaRating / DIVISOR_ELO) / divisor;
	let draw = 1 / divisor;
	let loss = 1 - win - draw;
	return [win, draw, loss]
}


async function main() {
	const contents = fs.readFileSync('maganha.csv', 'utf8');
	let lines = contents.split('\r\n');
	lines.sort();
	lines = [...new Set(lines)];
	let games = lines
		.map(x => x.split(','))
		.map(y => {
			let homeIndex = 3;
			let awayIndex = 6;
			let homeScoreIndex = 4;
			let awayScoreIndex = 5;
			if (y[2] == 'F' || (y[2] == 'N' && (y[6] < y[3]))) {
				homeIndex = 6;
				awayIndex = 3;
				homeScoreIndex = 5;
				awayScoreIndex = 4;
			}
			return {
				date: y[0],
				tournament: y[1],
				home: y[homeIndex],
				homeScore: y[homeScoreIndex],
				awayScore: y[awayScoreIndex],
				away: y[awayIndex]
			}
		});
	const uniqueGames = new Map();
	games.forEach(g => {
		uniqueGames.set([g.date, g.home, g.away].join(), g);
	});
	games = [...uniqueGames.values()];
	games.sort((a, b) => {
		if (a.date > b.date) return 1;
		if ((a.date == b.date) && (b.home == "Vasco da Gama-RJ" || b.away == "Vasco da Gama-RJ")) return 1;
		return -1;
	});

	const allTeams = [...new Set(games.map(x => x.home).concat(games.map(x => x.away)))]
	allTeams.sort();

	const ratings = new Map();
	const matchCount = new Map();
	allTeams.forEach(team => { ratings.set(team, 1000.0); matchCount.set(team, 0); });

	const importances = new Map([
		["Amazonense", 10], ["Amistoso", 5], ["Baiano", 10], ["Brasileiro", 40], ["Brasileiro-Série B", 30], ["Brasileiro-Série C", 20], ["CONMEBOL", 35], ["Carioca", 10], ["Copa Master CONMEBOL", 5], ["Copa Master Conmebol", 5], ["Copa Norte", 20], ["Copa Ouro CONMEBOL", 5], ["Copa Ouro Conmebol", 5], ["Copa do Brasil", 40], ["Copa do Nordeste", 20], ["Gaúcho", 10], ["Goiano", 10], ["Libertadores", 50], ["Mineiro", 10], ["Mundial Interclubes", 50], ["Paranaense", 10], ["Paulista", 10], ["Pernambucano", 10], ["Potiguar", 10], ["Recopa Sul-Americana", 35], ["Rio-São Paulo", 20], ["Supercopa Libertadores", 35], ["Torneio Amazonas-Pará", 5], ["Torneio Bortolotti-ITA", 5], ["Torneio Campeões Mundiais", 5], ["Torneio Centenário de Belo Horizonte-MG", 5], ["Torneio Cidade Maravilhosa-RJ", 5], ["Torneio Colombino-ESP", 5], ["Torneio Euro-América", 5], ["Torneio Festival Brasileiro de Futebol", 5], ["Torneio Início-Paulista", 5], ["Torneio Início-Potiguar", 5], ["Torneio Maguito Vilela-GO", 5], ["Torneio Maria Quitéria-BA", 5], ["Torneio Mercosul", 5], ["Torneio Naranja-ESP", 5], ["Torneio Palma de Mallorca-ESP", 5], ["Torneio President of Alaniya-RUS", 5], ["Torneio President-KAZ", 5], ["Torneio Ramón de Carranza-ESP", 5], ["Torneio Reebok-USA", 5], ["Torneio Renner-PE", 5], ["Torneio Renner-RS", 5], ["Torneio Teresa Herrera-ESP", 5], ["Torneio de Belo Horizonte-MG", 5], ["Torneio de Brasília-DF", 5], ["Torneio de Paranaguá-PR", 5], ["Torneio de Santos-SP", 5], ["Torneio de Verão de Santos-SP", 5], ["Torneio de Verão do Recife-PE", 5], ["Torneio dos Campeões Mundiais", 5], [undefined, 5]]);

	games.forEach(game => {

		game.homeRatingBefore = ratings.get(game.home);
		game.awayRatingBefore = ratings.get(game.away);
		let result = 0.5;

		if (game.homeScore > game.awayScore) {
			result = 1;
		} else if (game.homeScore < game.awayScore) {
			result = 0;
		}

		const goalDiff = Math.abs(game.homeScore - game.awayScore);
		let factor = 1;
		if (goalDiff == 2) factor = 1.5;
		if (goalDiff == 3) factor = 1.75;
		if (goalDiff > 3) factor = (1.75 + ((goalDiff - 3.0) / 8.0));
		let HFA = 100;
		let DIVISOR_ELO = 400.0
		const deltaRating = game.homeRatingBefore - game.awayRatingBefore + HFA;
		const winExpectancy = (1 / (1 + Math.pow(10, -(deltaRating) / DIVISOR_ELO)));
		const adjust = importances.get(game.tournament) * factor * (result - winExpectancy);
		game.homeRatingAfter = game.homeRatingBefore + adjust;
		game.awayRatingAfter = game.awayRatingBefore - adjust;
		ratings.set(game.home, game.homeRatingAfter);
		ratings.set(game.away, game.awayRatingAfter);
		let orderedRanking = [...ratings.keys()].sort((a, b) => (ratings.get(b) - ratings.get(a)));
		game.tupledRanking = orderedRanking.map((x, _idx) => { return [x, ratings.get(x)]; });

		game.homePos = orderedRanking.indexOf(game.home) + 1;
		game.awayPos = orderedRanking.indexOf(game.away) + 1;
		let [homeWinProb, drawProb, awayWinProb] = [...expectancy(game.homeRatingBefore, game.awayRatingBefore)];
		game.homeWinProb = homeWinProb;
		game.drawProb = drawProb;
		game.awayWinProb = awayWinProb;
		matchCount.set(game.home, matchCount.get(game.home) + 1);
		matchCount.set(game.away, matchCount.get(game.away) + 1);

	});

	rankByTeam = new Map();
	ratingByTeam = new Map();
	let teamsNames = [...matchCount.keys()].filter(x => matchCount.get(x) >= 20);
	teamsNames.forEach(x => { rankByTeam.set(x, []); ratingByTeam.set(x, []) });

	fs.appendFileSync('rankTime.csv', 'time', 'utf8');
	fs.appendFileSync('ratingTime.csv', 'time', 'utf8');

	fs.appendFileSync('out.csv', 'date;tournament;home;homeScore;awayScore;away;homeRatingBefore;awayRatingBefore;homePos;awayPos;homeWinProb;drawProb;awayWinProb;homeRatingAfer;awayRatingAfter\n', 'utf8');
	//fs.appendFileSync('rankingACadaJogo.csv','date;tournament;home;','utf8');
	games
		.filter(x => { return x.home == 'Vasco da Gama-RJ' || x.away == 'Vasco da Gama-RJ' })
		.filter(x => { return x.date >= '1997-01-01' })
		.forEach(g => {
			fs.appendFileSync('out.csv', `${g.date};${g.tournament};${g.home};${g.homeScore};${g.awayScore};${g.away};${g.homeRatingBefore.toFixed(2)};${g.awayRatingBefore.toFixed(2)};${g.homePos};${g.awayPos};${g.homeWinProb.toFixed(4)};${g.drawProb.toFixed(4)};${g.awayWinProb.toFixed(4)};${g.homeRatingAfter.toFixed(2)};${g.awayRatingAfter.toFixed(2)}\n`.replaceAll('.', ','), 'utf8');
			fs.appendFileSync('rankTime.csv', `;${g.date}`);
			fs.appendFileSync('ratingTime.csv', `;${g.date}`);
			let tr = g.tupledRanking.filter(([time, _]) => matchCount.get(time) >= 20).map(([t, r], idx) => [t, idx + 1, r]);

			tr.forEach(([time, rank, rate]) => {
				rankByTeam.get(time).push(rank);
				ratingByTeam.get(time).push(rate)
			});
		});
	rankByTeam.keys().forEach(k => {
		fs.appendFileSync('rankTime.csv', `\n${k}`, 'utf8');
		rankByTeam.get(k).forEach(rank => fs.appendFileSync('rankTime.csv', `;${rank}`, 'utf8'));
	});
	ratingByTeam.keys().forEach(k => {
		console.log(k, ratingByTeam.get(k));
		fs.appendFileSync('ratingTime.csv', `\n${k}`, 'utf8');
		ratingByTeam.get(k).forEach(rating => fs.appendFileSync('ratingTime.csv', `;${rating}`, 'utf8'));
	});
}

main()
