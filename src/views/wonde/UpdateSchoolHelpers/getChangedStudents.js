// get the students that have been updated since "aferDate"
const axios = require('axios')
const { getToken, getURL } = require('../CommonHelpers/featureToggles')

async function getChangedStudents(school, afterDate) {
  let students = []
  try {
    let URL = `${getURL()}/${
      school.wondeID
    }/students?updated_after=${afterDate}&include=year,classes&per_page=200`
    let morePages = true
    while (morePages) {
      console.log(URL)
      let response = await axios({
        method: 'get',
        url: URL,
        headers: {
          Authorization: getToken(),
        },
      })
      // eslint-disable-next-line no-loop-func
      response.data.data.forEach((student) => {
        students.push(student)
      })
      // check if all pages are read
      if (response.data.meta.pagination.next != null) {
        URL = response.data.meta.pagination.next
      } else {
        morePages = false
      }
    }
  } catch (error) {
    console.log(error)
    return []
  }

  return students
}

export default getChangedStudents
