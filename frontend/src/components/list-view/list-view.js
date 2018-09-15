import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../constance';
import ListItem from './list-item';

const propTypes = {
  isItemFreezed: PropTypes.bool.isRequired,
  draftList: PropTypes.array.isRequired,
  onMenuToggleClick: PropTypes.func.isRequired,
};

class ListView extends React.Component {

  render() {
    let drafts = this.props.draftList;
    return (
      <table>
        <thead>
          <tr>
            <th style={{width: '4%'}}>{/*img*/}</th>
            <th style={{width: '46%'}}>{gettext('Name')}</th>
            <th style={{width: '20%'}}>{gettext('Owner')}</th>
            <th style={{width: '20%'}}>{gettext('Update time')}</th>
            <th style={{width: '10%'}}></th>
          </tr>
        </thead>
        <tbody>
          { drafts && drafts.map((draft) => {
            return (
              <ListItem 
                key={draft.id} 
                draft={draft} 
                onMenuToggleClick={this.props.onMenuToggleClick} 
                isItemFreezed={this.props.isItemFreezed}
              />
            );
          })}
        </tbody>
      </table>
    );
  }
}

ListView.propTypes = propTypes;

export default ListView;
