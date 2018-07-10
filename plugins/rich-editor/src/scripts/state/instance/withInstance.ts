/**
 * Contains the root AppState interface
 *
 * @copyright 2009-2018 Vanilla Forums Inc.
 * @license http://www.opensource.org/licenses/gpl-2.0.php GNU GPL v2
 */

import { connect } from "react-redux";
import IState from "@rich-editor/state/IState";
import Quill from "quill/core";
import { getIDForQuill } from "@rich-editor/quill/utility";

interface IQuillProps {
    quill: Quill;
}

/**
 * Map in the instance state of the current editor.
 */
function mapStateToProps(state: IState, ownProps: IQuillProps) {
    const { quill } = ownProps;
    if (!quill) {
        return {};
    }

    const id = getIDForQuill(quill);
    const instanceState = state.editor.instances[id];
    return instanceState;
}

export default connect(mapStateToProps);
