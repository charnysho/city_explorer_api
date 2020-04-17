'use strict';

require('dotenv').config();

const pg = require('pg');
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const iso1A2Code = require('@ideditor/country-coder').iso1A2Code;

const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());

function Location(data, searchQuery) {
  this.search_query = searchQuery;
  this.formatted_query = data.display_name;
  this.latitude = data.lat;
  this.longitude = data.lon;
}

function Forecast(data, forecast) {
  this.forecast = forecast;
  this.time = new Date(data).toDateString();
}

function Trail(data) {
  this.name = data.name;
  this.location = data.location;
  this.length = data.length;
  this.stars = data.stars;
  this.star_votes = data.starVotes;
  this.summary = data.summary;
  this.trail_url = data.url;
  this.conditions = data.conditionDetails;
  this.condition_date = formatConditionDate(new Date(data.conditionDate));
  this.condition_time = formatConditionTime(new Date(data.conditionDate));
}

function Movie(data) {
  this.title = data.title;
  this.overview = data.overview;
  this.average_votes = data.vote_average;
  this.total_votes = data.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
  this.popularity = data.popularity;
  this.released_on = data.release_date;
}

function Restaurants(data) {
  this.name = data.name;
  this.image_url = data.image_url;
  this.price = data.price;
  this.rating = data.rating;
  this.url = data.url;
}

function formatConditionDate(data) {
  const year = data.getFullYear();
  const month = data.getMonth() + 1;
  const day = data.getDate();
  return `${year}-${month}-${day}`;
}

function formatConditionTime(data) {
  const hours = data.getHours();
  const min = data.getMinutes();
  const sec = data.getSeconds();
  return `${hours}:${min}:${sec}`;
}

function handleLocation(request, response) {

  let filterValue = request.query.city;
  let searchSqlQuery = `SELECT formatted_query as display_name, latitude as lat, longitude as lon FROM locations WHERE search_query=$1`;

  dbClient.query(searchSqlQuery, [filterValue])
    .then(record => {
      if(record.rows.length > 0) {
        console.log('FOUND in DB');
        response.send(new Location(record.rows[0], filterValue));
      } else {
        returnlocationFromGeocodeApi(request, response, filterValue);
      }
    })
    .catch(error => {
      errorHandler(error, request, response);
    });
}

function returnlocationFromGeocodeApi(request, response, filterValue) {
  const key = process.env.GEOCODE_API_KEY;
  const url = `https://us1.locationiq.com/v1/search.php?key=${key}&q=${filterValue}&format=json&limit=1`;
  superagent.get(url)
    .then(locationResponse => {
      const data = locationResponse.body;
      data.map( item => {
        if(item.display_name.search(filterValue)) {
          const location = new Location(item, filterValue);
          console.log('FOUND in API');

          let insertSql = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *`;
          dbClient.query(insertSql, [location.search_query, location.formatted_query, location.latitude, location.longitude]);

          response.send(location);
        }
      });
    })
    .catch( error => {
      errorHandler(error, request, response);
    });
}

function handleWeather(request, response) {
  const { latitude, longitude } = request.query;
  const key = process.env.WEATHER_API_KEY;
  const url = `https://api.weatherbit.io/v2.0/forecast/daily?lat=${latitude}&lon=${longitude}&key=${key}`;
  superagent.get(url)
    .then(weatherResponse => {
      const data = weatherResponse.body.data;
      const results = [];
      data.map(item => results.push(new Forecast(item.datetime, item.weather.description)));
      response.send(results);
    })
    .catch( error => {
      errorHandler(error, request, response);
    });
}

function handleTrails(request, response) {
  const { latitude, longitude } = request.query;
  const key = process.env.TRAIL_API_KEY;
  const url = `https://www.hikingproject.com/data/get-trails?lat=${latitude}&lon=${longitude}&maxDistance=10&key=${key}`;
  superagent.get(url)
    .then(trailsResponse => {
      const data = trailsResponse.body.trails;
      const results = [];
      data.map(item => results.push(new Trail(item)));
      response.send(results);
    })
    .catch( error => {
      errorHandler(error, request, response);
    });
}

function handleMovies(request, response) {
  const { latitude, longitude } = request.query;
  const region = iso1A2Code([longitude, latitude]);
  const key = process.env.MOVIE_API_KEY;
  const url = `https://api.themoviedb.org/3/movie/top_rated/?api_key=${key}&region=${region}`;
  superagent.get(url)
    .then(moviesResponse => {
      const data = moviesResponse.body.results;
      const results = [];
      let numberOfMovies = 0;
      while (numberOfMovies !== 20) {
        results.push(new Movie(data[numberOfMovies]));
        numberOfMovies = numberOfMovies + 1;
      }
      response.send(results);
    })
    .catch( error => {
      errorHandler(error, request, response);
    });
}

function handleRestaurants(request, response) {
  const { latitude, longitude } = request.query;
  const key = process.env.YELP_API_KEY;
  const url =
  `https://api.yelp.com/v3/businesses/search?&term=restaurants&latitude=${latitude}&longitude=${longitude}`;
  superagent.get(url)
    .set('Authorization', `Bearer ${key}`)
    .then(moviesResponse => {
      const data = moviesResponse.body.businesses;
      console.log('RESULT');
      console.log(data);
      const results = [];
      let numberOfRest = 0;
      while (numberOfRest !== 20) {
        results.push(new Restaurants(data[numberOfRest]));
        numberOfRest = numberOfRest + 1;
      }
      response.send(results);
    })
    .catch( error => {
      errorHandler(error, request, response);
    });
}

function errorHandler(error, request, response, next) {
  console.log(error);
  response.status(500).send({
    status: 500,
    responseText: 'Sorry, something went wrong',
  });
}

app.get('/location', handleLocation);
app.get('/weather', handleWeather);
app.get('/trails', handleTrails);
app.get('/movies', handleMovies);
app.get('/yelp', handleRestaurants);
app.use(errorHandler);

const dbClient = new pg.Client(process.env.DATABASE_URL);

dbClient.connect(err => {
  if (err) {
    console.log('ERROR: ' + err);
  } else {
    app.listen(PORT, () => {
      console.log('Server is running on PORT: ' + PORT);
    });
  }
});
