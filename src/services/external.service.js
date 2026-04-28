const axios = require('axios');

async function fetchGenderize(name) {
  const { data } = await axios.get(`https://api.genderize.io?name=${name}`);
  if (!data.gender || data.count === 0) {
    const err = new Error('Genderize returned an invalid response');
    err.status = 502;
    throw err;
  }
  return { gender: data.gender, gender_probability: data.probability, sample_size: data.count };
}

async function fetchAgify(name) {
  const { data } = await axios.get(`https://api.agify.io?name=${name}`);
  if (data.age === null || data.age === undefined) {
    const err = new Error('Agify returned an invalid response');
    err.status = 502;
    throw err;
  }
  return { age: data.age };
}

async function fetchNationalize(name) {
  const { data } = await axios.get(`https://api.nationalize.io?name=${name}`);
  if (!data.country || data.country.length === 0) {
    const err = new Error('Nationalize returned an invalid response');
    err.status = 502;
    throw err;
  }
  return { countries: data.country };
}

module.exports = { fetchGenderize, fetchAgify, fetchNationalize };