// These are hard-coded for convenience ToDo: Save elsewhere
const UKURL = 'https://api.wonde.com/v1.0/schools'
const UKTOKEN = 'Bearer a3f049794493180ed83fb310da37715f856c3670' // new as of 9/2/2022
const AUSURL = 'https://api-ap-southeast-2.wonde.com/v1.0/schools'
const AUSTOKEN = 'Bearer 4ef8fc0053696f4202062ac598943fc1de66c606' // new as of 9/2/2022

// FEATURE-TOGGLE
export function getURL() {
  // return UKURL
  switch (process.env.REACT_APP_REGION) {
    case 'ap-southeast-2':
      return AUSURL
    case 'eu-west-2':
      return UKURL
    default:
      return AUSURL
  }
}
// FEATURE-TOGGLE
export function getToken() {
  // return UKTOKEN
  switch (process.env.REACT_APP_REGION) {
    case 'ap-southeast-2':
      return AUSTOKEN
    case 'eu-west-2':
      return UKTOKEN
    default:
      return AUSTOKEN
  }
}
