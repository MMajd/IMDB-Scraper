const fs = require('fs'); 

const requestPromise = require('request-promise');
const request = require('request'); 
const cheerio = require('cheerio'); 

const config = require('./config');  


function createPostersDir() { 
    var dir = './posters';

    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
}

async function downloadPoster(title, year, posterURL) { 
    await new Promise((resolve, reject) => {
        request({
            uri: posterURL, 
            headers: config.headers,
            gzip: true
        })
        .pipe(fs.createWriteStream(`./posters/${title + ' ' + year}.jpg`))
        .on('finish', () => {
            console.log('Finished: downloading', title, 'poster');
            resolve(true);
        })
        .on('error', (error) => {
            reject(error);
        })
    })
    .catch(error => { 
        console.log('Error: cannot download', title, 'poster');
        console.error('Error: ', error);  
    }); 
}

async function loadMoviesLinks(topURL) { 
    let URLS = [];
    
    const response = await requestPromise({
        uri: topURL,
        headers: config.headers,
        gzip: true,
    });

    const $ = await cheerio.load(response);

    console.log("STARTING: scraping top 250 movies links");

    $('.lister-list tr').each((i, tr) => {
        let $tr = cheerio.load(tr);
        let link = $tr('a').attr('href');
        URLS.push(config.baseURL + link);
    });

    console.log("FINISHED: scraping top 250 movies links");

    await loadMoviesData(URLS); 
}

async function loadMoviesData (URLS) { 
    createPostersDir(); 

    let movies = []; 

    for (let [index, url] of URLS.entries()) {
        console.log(`STARTING ${index + 1}: scraping new movie data`);  
        const page = await requestPromise({
            uri: url, 
            headers: config.headers, 
            gzip: true, 
        })
        const $ = await cheerio.load(page);
        
        let year = await $('.titleBar > .title_wrapper > h1 > span').text().trim();
        let title = await $('.titleBar > .title_wrapper > h1').text().trim();
        
        if (year !== '') title = title.substr(0, title.length - year.length).trim();
        else year = 'N/A'; 
    
        let genres = await $('.titleBar > .title_wrapper > .subtext > a[href*="genres"]').text().trim().split(/(?=[A-Z])/);
        let playTime = await $('.titleBar > .title_wrapper > .subtext > time').text().trim();
        let ratingValue = await $('.imdbRating .ratingValue > strong > span').text().trim(); 
        let ratingCount = await $('.imdbRating > a[href*="ratings"]').text().trim();
        let ratings = { 'value': ratingValue, 'count': ratingCount};
        
        let posterURL = await $('.poster  img').attr('src'); 
        let posterURLHighRes = posterURL.substr(0, posterURL.indexOf("._"));  
        let summary = await $('.plot_summary > .summary_text').text().trim(); 
        
        let credits = {}; 
        await $('.plot_summary > .credit_summary_item').each((i, div) => { 
            let $div = cheerio.load(div);
            let key = $div('h4').text().trim();
            key = key.substr(0, key.length-1); 
            
            let values = []; 
            
            $div('a').each((i, a) => { 
                $a = cheerio.load(a); 
                values.push($a.text()); 
            }); 
            
            if (values.length > 2) values.splice(values.length-1); 
            
            credits[key] = values; 
    
        }); 
    
        movies.push({ 
            title, 
            year, 
            summary, 
            playTime, 
            ratings, 
            genres, 
            credits, 
            posterURL, 
            posterURLHighRes
        }); 

        downloadPoster(title, year, posterURL);     
    }

    console.log("FINISHED: scraping all movies data... \nsaving the data..."); 
    fs.writeFileSync('./movies.json', JSON.stringify(movies), 'utf-8'); 
}

loadMoviesLinks('https://www.imdb.com/chart/top');