import React from 'react'

// create a context variable for use by child components
// specifically this will pass down the login state to all components
// the Login components sets the state  and logout function clears it
const loggedInContext = React.createContext(null)

export default loggedInContext
