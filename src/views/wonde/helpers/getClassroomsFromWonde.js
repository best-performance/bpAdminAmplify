import { getToken, getURL } from './wondeUrlToken'
import axios from 'axios'

// gets the classromms for a particular school
// It is only used where we know subjects have been added to the classrooms
//  - maybe secondary schools only
export async function getClassroomsFromWonde(wondeSchoolID) {
  let wondeClassrooms = []
  try {
    let URL = `${getURL()}/${wondeSchoolID}/classes/?include=subject&per_page=200`
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
      console.log('classrooms:', response.data.data.length)
      // eslint-disable-next-line no-loop-func
      response.data.data.forEach((classroom) => {
        wondeClassrooms.push(classroom) // save the original response data
      })
      // check if all pages are read
      if (response.data.meta.pagination.next != null) {
        URL = response.data.meta.pagination.next
      } else {
        morePages = false
      }
    }
  } catch (error) {
    console.log('error reading Wonde teachers', error.message)
    return { result: false, msg: error.message }
  }
  return { wondeCalssrooms: wondeClassrooms }
}
