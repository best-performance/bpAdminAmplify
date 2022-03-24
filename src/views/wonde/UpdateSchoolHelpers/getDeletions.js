// get the classes that have been updated ince "aferDate" (classrooms)
const axios = require('axios')
async function getDeletions(url, token, currentSchool, type, afterDate) {
  // type is "student" etc
  let deletions = []
  try {
    let URL = `${url}/${currentSchool.schoolID}/deletions?type=${type}&update_after=${afterDate}&per_page=200`
    let morePages = true
    while (morePages) {
      console.log(URL)
      let response = await axios({
        method: 'get',
        url: URL,
        headers: {
          Authorization: token,
        },
      })
      // eslint-disable-next-line no-loop-func
      response.data.data.forEach((deletion) => {
        deletions.push(deletion) // not filtering out the restored records here
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
  }

  return deletions
}

export default getDeletions
