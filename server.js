'use strict';

require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');
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

function handleLocation(request, response) {
  let location;
  let locations = require('./data/location.json');
  let filterValue = request.query.city;
  for (const i in locations) {
    if (locations[i].display_name.toLowerCase().includes(filterValue.toLowerCase())) {
      location = new Location(locations[i], filterValue);
    }
  }
  console.log(location);
  if(typeof location !== 'undefined') {
    response.status(200).send(location);
  } else {
    throw new Error('BROKEN');
  }
}

function handleWeather(request, response) {
  let weatherData = require('./data/weather.json').data;
  const results = [];
  weatherData.forEach(item => {
    results.push(new Forecast(item.datetime, item.weather.description));
  });
  response.send(results);
}

function errorHandler(error, request, response, next) {
  response.status(500).send({
    status: 500,
    responseText: 'Sorry, something went wrong',
  });
}

app.get('/location', handleLocation);
app.get('/weather', handleWeather);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log('Server is running on PORT: ' + PORT);
});

