
// bot.js (ES module version using database.js directly)
import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder } from 'discord.js';
import { query, isSQLite } from './database.js';
const { default: runScanner } = await import('./scanner.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith('.')) return;

  console.log(`${new Date().toLocaleString()} - ${message.author.tag}: ${message.content}`);

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'm' || command === 'movie') {
    const { queryText, year, limit } = parseMovieArgs(args);
    let searchText = queryText;

    try {
      let movie;
      let sql = `SELECT * FROM Movie_Info WHERE 1=1`;
      let sqlArgs = [];

      if (queryText) {
        sql += ` AND title LIKE ?`;
        sqlArgs.push(`%${queryText}%`);
      }

      if (year) {
        sql += ` AND year = ?`;
        sqlArgs.push(year);
        searchText = queryText+' ('+year+')'.trim();
      }

      sql += ` ORDER BY title ASC LIMIT 1`;

      let rows = await query(sql, sqlArgs);
      movie = rows[0];

      if (!movie || (!queryText && !year)) {
        // fallback to random if no filters
        sql = `SELECT * FROM Movie_Info ORDER BY ${isSQLite ? 'RANDOM()' : 'RAND()'} LIMIT 1`;
        sqlArgs = [];
        rows = await query(sql, sqlArgs);
        movie = rows[0];
        searchText = `${searchText ? searchText+'\n' : ''}No Result, Random movie chosen`;
      }

      const embed = createMovieEmbed(movie, message.author, searchText);
      const reply = await message.channel.send({ embeds: [embed] });
      await message.delete().catch(() => {});
      setTimeout(() => reply.delete().catch(() => {}), 5 * 60 * 1000);
    } catch (err) {
      console.error('Error retrieving movie:', err);
      message.reply('❌ Error retrieving movie.');
    }
  }

  if (command === 'ml' || command === 'list') {
    const { queryText, year, limit } = parseMovieArgs(args);
    let finalLimit = 10;
    if (limit && (limit <= 25 && limit > 0)) {
      finalLimit = limit;
    }

    let sql;
    let sqlArgs = [];

    if (!queryText && !year) {
      // No args == random movies
      sql = `SELECT * FROM Movie_Info ORDER BY ${isSQLite ? 'RANDOM()' : 'RAND()'} LIMIT ?`;
      sqlArgs.push(finalLimit);
    } else {
      // Build search query
      sql = `SELECT * FROM Movie_Info WHERE 1=1`;
      if (queryText) {
        sql += ` AND title LIKE ?`;
        sqlArgs.push(`%${queryText}%`);
      }
      if (year) {
        sql += ` AND year = ?`;
        sqlArgs.push(year);
      }
      if (!queryText && year) {
        sql += ` ORDER BY ${isSQLite ? 'RANDOM()' : 'RAND()'} LIMIT ?`;
      } else {
        sql += ` ORDER BY title ASC LIMIT ?`;
      }
      sqlArgs.push(finalLimit);
    }

    try {
      const rows = await query(sql, sqlArgs);
      if (!rows.length) return message.reply('❌ No movies found.');

      let searchText = queryText;
      if (year) {
        searchText = queryText+' ('+year+')'.trim(); 
      }

      const embed = new EmbedBuilder()
        .setTitle(
          !queryText && !year
            ? '🎬 Random Movies'
            : `🎬 Movies matching: "${searchText}"`.trim()
        )
        .setDescription(
          rows
            .map((m, i) => `**${i + 1}.**  ${m.title} (${m.year === '0000' ? 'n/a' : m.year})\n   -   ${m.format}   -   ${formatBytes(m.filesize)}${m.year === '0000' ? '\n' : '   -   [IMDB](https://www.imdb.com/title/${m.imdb})\n'}`)
            .join('\n')
        )
        .setColor(0x2ecc71)
        .setFooter({ text: `Requested by ${message.author.username}` })
        .setFooter({
          text: `${message.author.username}\n${searchText}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();

      const reply = await message.channel.send({ embeds: [embed] });
      await message.delete().catch(() => {});
      setTimeout(() => reply.delete().catch(() => {}), 5 * 60 * 1000);
    } catch (err) {
      console.error('Error retrieving movie list:', err);
      message.reply('❌ Error retrieving movie list.');
    }
  }

  if (command === 'random') {
    try {
      const rows = await query(`SELECT * FROM Movie_Info ORDER BY ${isSQLite ? 'RANDOM()' : 'RAND()'} LIMIT 1`);
      const movie = rows[0];
      if (!movie) return message.reply('❌ No random movie found.');

      const embed = createMovieEmbed(movie, message.author, '');
      const reply = await message.channel.send({ embeds: [embed] });
      await message.delete().catch(() => {});
      setTimeout(() => reply.delete().catch(() => {}), 5 * 60 * 1000);
    } catch (err) {
      console.error('Error fetching random movie:', err);
      message.reply('❌ Error fetching random movie.');
    }
  }

// scan movie command
  if (command === 'scan' || command === 'rescan') {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply('You do not have permission to trigger a scan.');
    }

    try {
      const initialEmbed = new EmbedBuilder()
        .setTitle('🔍 Starting scan for new movies...')
        .setColor(0x2ecc71)
        .setFooter({ text: `Scanning movies...` })
        .setTimestamp();

      const reply = await message.channel.send({ embeds: [initialEmbed] });

      if (message.channel.permissionsFor(message.client.user).has('ManageMessages')) {
        message.delete().catch(() => {});
      }

      // Start periodic typing indicator
      const typingInterval = setInterval(() => {
        message.channel.sendTyping().catch(() => {});
      }, 8000); // Re-send every 8s to keep it alive

      const result = await runScanner();
      clearInterval(typingInterval); // Stop when done

      const finalEmbed = new EmbedBuilder()
        .setTitle('✅ Scan Complete!')
        .setColor(0x2ecc71)
        .setDescription(
          `**Total movies:** ${result.totalFiles}\n` +
          `**Movies added:** ${result.newMovies}\n` +
          `**Movies updated:** ${result.updatedMovies}`
        )
        .setFooter({ text: `Movie scan completed` })
        .setTimestamp();

      await reply.edit({ embeds: [finalEmbed] });

      // Send new movies to a channel
      if (result.addedList.length > 0) {
        const channel = message.guild.channels.cache.find(c =>
          c.name === 'general' && c.isTextBased?.()
        );
        if (channel) {

          const movieList = result.addedList
            .map((m, i) => `**[${i + 1}. ${m.title} (${m.year})](https://www.imdb.com/title/${m.imdb})**`);

          const chunks = chunkLines(movieList, 25); // 25 movies per page
          let currentPage = 0;

          // Build the initial embed
          const buildEmbed = (page) =>
            new EmbedBuilder()
              .setTitle('🎬 '+result.newMovies+' New Movies Added')
              .setColor(0x2ecc71)
              .setDescription(chunks[page].join('\n'))
              .setFooter({ text: `Page ${page + 1} of ${chunks.length}` })
              .setTimestamp();

          // Build navigation buttons
          const getRow = () =>
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('⬅ Prev')
                .setStyle(1)
                .setDisabled(currentPage === 0),
              new ButtonBuilder()
                .setCustomId('next')
                .setLabel('Next ➡')
                .setStyle(1)
                .setDisabled(currentPage === chunks.length - 1)
            );

          // Send the first embed with buttons
          const sent = await message.channel.send({
            embeds: [buildEmbed(currentPage)],
            components: [getRow()]
          });

          // Set up button collector
          const collector = sent.createMessageComponentCollector({
            //time: 60_000 // 1 minute
          });

          collector.on('collect', async (interaction) => {
            if (interaction.customId === 'prev') currentPage--;
            if (interaction.customId === 'next') currentPage++;

            await interaction.update({
              embeds: [buildEmbed(currentPage)],
              components: [getRow()]
            });
          });

          collector.on('end', async () => {
            // Disable buttons after timeout
            //await sent.edit({ components: [] }).catch(() => {});
          });
        }
      }

      setTimeout(() => reply.delete().catch(() => {}), 5 * 60 * 1000);

    } catch (err) {
      clearInterval(typingInterval);
      console.error('Scan failed:', err);
      message.reply('Scan failed. Check server logs for details.');
    }
  }

});


function formatBytes(a, b = 2, k = 1024) {
  if (a === 0) return '0 Bytes';
  const i = Math.floor(Math.log(a) / Math.log(k));
  return `${(a / Math.pow(k, i)).toFixed(b)} ${['Bytes', 'KB', 'MB', 'GB', 'TB'][i]}`;
}

function parseMovieArgs(args) {
  let queryText = null;
  let year = null;
  let limit = null;
  let joined = args.join(' ');

  const yearMatch = joined.match(/-y (\d{4})/i);
  if (yearMatch) {
    year = yearMatch[1];
    joined = joined.replace(yearMatch[0], '').trim();
  }
  let limitMatch = joined.match(/-l (\d+)/i);
  if (limitMatch) {
    limit = parseInt(limitMatch[1], 10);
    joined = joined.replace(limitMatch[0], '').trim();
  }
  let limitMatch2 = joined.match(/-(\d+)/i);
  if (limitMatch2) {
    limit = parseInt(limitMatch2[1], 10);
    joined = joined.replace(limitMatch2[0], '').trim();
  }

  return { queryText:joined, year, limit };
}

function createMovieEmbed(movie, user, search) {
  const embed = new EmbedBuilder()
    .setTitle(`${movie.title} (${movie.year || '0000'})`)
    .setDescription(movie.overview || 'No overview available.')
    .setColor(0x2ecc71)
    .addFields(
      { name: 'Format', value: movie.format || '', inline: true },
      { name: 'Filesize', value: formatBytes(movie.filesize) || 'N/A', inline: true },
      { name: 'Rating', value: movie.rating || 'N/A', inline: true }
    )
    .setFooter({
          text: `${user.tag}\n${search}`,
          iconURL: user.displayAvatarURL({ dynamic: true })
        })
    .setTimestamp();

/*
  if (movie.poster || movie.poster_fallback) {
    embed.setThumbnail(
      `http://localhost:3000/movies/${movie.poster}`
    );
  }
*/

  let posterURL = movie.poster_fallback || movie.posterURL;
  if (posterURL?.startsWith('http')) {
    embed.setThumbnail(posterURL);
  } else {
    posterURL = `http://localhost:3000/movies/${encodeURI(movie.posterURL)}`;
    embed.setThumbnail(posterURL);
  }

  return embed;
}


function chunkLines(lines, size = 10) {
  const result = [];
  for (let i = 0; i < lines.length; i += size) {
    result.push(lines.slice(i, i + size));
  }
  return result;
}

client.login(process.env.DISCORD_TOKEN);
