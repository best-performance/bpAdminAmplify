import axios from 'axios'
// Read all available schools directly from Wonde
// The url is the regions specific url
// The token is the region specific token
export async function getAllSchoolsFromWonde(url, token) {
  //console.log(url)
  //console.log(token)
  let schools = []
  try {
    let response = await axios({
      method: 'get',
      url: url,
      headers: {
        Authorization: token,
      },
    })
    response.data.data.forEach((school) => {
      schools.push({
        wondeID: school.id, // Wonde call it id
        schoolName: school.name,
        urn: school.urn,
        address1: school.address.address_line_1,
        address2: school.address.address_line_2,
        town: school.address.address_town,
        country: school.address.address_country.name,
      })
    })
    return schools
  } catch (err) {
    console.log(err)
    return false
  }
}
