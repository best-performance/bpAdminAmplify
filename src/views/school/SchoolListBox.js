import React from 'react'
import SelectBox from 'devextreme-react/select-box'
import List from 'devextreme-react/list'
import { schools } from './schooldata.js'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

function ItemTemplate(data) {
  return <div>{data.Name}</div>
}
const searchModes = ['contains', 'startsWith', 'equals']

const SchoolListBox = (props) => {
  const [searchMode, setState] = useState('contains')
  const onSearchModeChange = (args) => {
    setState(args.value)
  }
  useEffect(() => {
    console.log('Updating school list... not yet implemented')
  })
  const setUploadData = (event) => {
    props.parentCallback(event.itemData)
  }
  return (
    <React.Fragment>
      <div className="list-container">
        <List
          dataSource={schools}
          height={400}
          itemRender={ItemTemplate}
          searchExpr="Name"
          searchEnabled={true}
          searchMode={searchMode}
          onItemClick={setUploadData}
        />
      </div>
      <div className="options">
        <div className="caption">Options</div>
        <div className="option">
          <span>Search mode </span>
          <SelectBox items={searchModes} value={searchMode} onValueChanged={onSearchModeChange} />
        </div>
      </div>
    </React.Fragment>
  )
}

SchoolListBox.propTypes = {
  parentCallback: PropTypes.any,
}

export default SchoolListBox
