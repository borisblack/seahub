import React from 'react';
import PropTypes from 'prop-types';
import { siteRoot, lang } from '../constance';
import NodeMenuControl from '../menu-component/node-menu-control';
import moment from 'moment';

moment.locale(lang);
const propTypes = {
  isItemFreezed: PropTypes.bool.isRequired,
  onMenuToggleClick: PropTypes.func.isRequired,
}
class ListItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isMenuControlShow: false,
      highlight: '',
    };
  }

  onMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isMenuControlShow: true,
        highlight: 'tr-highlight'
      });
    }
  }

  onMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isMenuControlShow: false,
        highlight: ''
      });
    }
  }

  onMenuToggleClick = (e) => {
    e.nativeEvent.stopImmediatePropagation();
    let draft = this.props.draft;
    this.props.onMenuToggleClick(e, draft);
  }

  onDraftEditClick = () => {
    let draft = this.props.draft;
    let filePath = draft.draft_file_path;
    let repoID = draft.draft_repo_id;
    window.location.href= siteRoot + 'lib/' + repoID + '/file' + filePath + '?mode=edit';
  }

  getFileName(filePath) {
    let lastIndex = filePath.lastIndexOf("/");
    return filePath.slice(lastIndex+1);
  }

  render() {
    let draft = this.props.draft;
    let fileName = this.getFileName(draft.draft_file_path);
    let localTime = moment.utc(draft.updated_at).toDate();
    localTime = moment(localTime).fromNow();
    return (
      <tr className={this.state.highlight} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <td className="icon" style={{width: "4%"}}><img src={siteRoot + "media/img/file/192/txt.png"} /></td>
        <td className="name a-simulate" style={{width: "46%"}} onClick={this.onDraftEditClick}>{fileName}</td>
        <td className="owner" style={{width: "20%"}}>{draft.owner}</td>
        <td className="update" style={{width: "20%"}}>{localTime}</td>
        <td className="menu-toggle" style={{width: "10%"}}>
          <NodeMenuControl
            isShow={this.state.isMenuControlShow}
            onClick={this.onMenuToggleClick}
          />
        </td>
      </tr>
    );
  }
}

ListItem.propTypes = propTypes;

export default ListItem;
