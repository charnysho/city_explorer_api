'use strict';

require('dotenv').config();

const pg = require('pg');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');
const superagent = require('superagent');
app.use(cors());

function Location(data, searchQuery) {
  this.search_query = searchQuery;
  this.formatted_query = data.display_name;
  this.latitude = data.lat;
  this.longitude = data.lon;
}

function Forecast(date, forecast) {
  this.forecast = forecast;
  this.time = new Date(date).toDateString();
}

function Trail(date) {
  this.name = date.name;
  this.location = date.location;
  this.length = date.length;
  this.stars = date.stars;
  this.star_votes = date.starVotes;
  this.summary = date.summary;
  this.trail_url = date.url;
  this.conditions = date.conditionDetails;
  this.condition_date = formatConditionDate(new Date(date.conditionDate));
  this.condition_time = formatConditionTime(new Date(date.conditionDate));
}

function formatConditionDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${month}-${day}`;
}

function formatConditionTime(date) {
  const hours = date.getHours();
  const min = date.getMinutes();
  const sec = date.getSeconds();
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
