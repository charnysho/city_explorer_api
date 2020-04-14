'use strict';

require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const cors = require('cors');
app.use(cors());


function Location(geo, searchQuery) {
  this.search_query = searchQuery;
  this.formatted_query = geo.display_name;
  this.latitude = geo.lat;
  this.longitude = geo.lon;
}

function parseSearchQuery(searchQuery) {
  let locations = require('./data/geo.json');
  let filterValue = searchQuery.filter_value;

  for (const i in locations) {
    const location = locations[i];
    console.log(location.display_name, filterValue);
    if (location.display_name.includes(filterValue)) {
      return new Location(location, filterValue);
    }
  }
}

app.get('/location', (request, response) => {
  let location = parseSearchQuery(request.query);
  if (location) {
    response.status(200).send(location);
  } else {
    response.status(404).send('Cant find your city');
  }
});

app.listen(PORT, () => {
  console.log('Server is running on PORT: ' + PORT);
});
