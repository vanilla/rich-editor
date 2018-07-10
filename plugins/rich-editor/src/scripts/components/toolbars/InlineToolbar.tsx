/**
 * @author Adam (charrondev) Charron <adam.c@vanillaforums.com>
 * @copyright 2009-2018 Vanilla Forums Inc.
 * @license https://opensource.org/licenses/GPL-2.0 GPL-2.0
 */

import React from "react";
import Quill, { RangeStatic, Sources } from "quill/core";
import Emitter from "quill/core/emitter";
import Keyboard from "quill/modules/keyboard";
import LinkBlot from "quill/formats/link";
import { t, isAllowedUrl } from "@dashboard/application";
import ToolbarContainer from "./pieces/ToolbarContainer";
import { withEditor, IEditorContextProps } from "@rich-editor/components/context";
import { IMenuItemData } from "./pieces/MenuItem";
import InlineToolbarItems from "./pieces/InlineToolbarItems";
import InlineToolbarLinkInput from "./pieces/InlineToolbarLinkInput";
import { watchFocusInDomTree } from "@dashboard/dom";
import { rangeContainsBlot, disableAllBlotsInRange, getIDForQuill } from "@rich-editor/quill/utility";
import CodeBlot from "@rich-editor/quill/blots/inline/CodeBlot";
import CodeBlockBlot from "@rich-editor/quill/blots/blocks/CodeBlockBlot";
import withInstance from "@rich-editor/state/instance/withInstance";
import { IEditorInstance } from "@rich-editor/state/IState";

interface IProps extends IEditorContextProps, IEditorInstance {}

interface IState {
    inputValue: string;
    isLinkActive: boolean;
    hasRealFocus: boolean;
}

export class InlineToolbar extends React.Component<IProps, IState> {
    private quill: Quill;
    private linkInput: React.RefObject<HTMLInputElement> = React.createRef();
    private selfRef: React.RefObject<HTMLDivElement> = React.createRef();
    private ignoreSelectionChange = false;

    /**
     * @inheritDoc
     */
    constructor(props) {
        super(props);

        // Quill can directly on the class as it won't ever change in a single instance.
        this.quill = props.quill;

        this.state = {
            inputValue: "",
            isLinkActive: false,
            hasRealFocus: false,
        };
    }

    public render() {
        const { lastGoodSelection } = this.props;
        const alertMessage = this.isFormatMenuVisible ? (
            <span aria-live="assertive" role="alert" className="sr-only">
                {t("Inline Menu Available")}
            </span>
        ) : null;

        const toolbars = lastGoodSelection ? (
            <React.Fragment>
                <ToolbarContainer selection={lastGoodSelection} isVisible={this.isFormatMenuVisible}>
                    {alertMessage}
                    <InlineToolbarItems currentSelection={lastGoodSelection} linkFormatter={this.linkFormatter} />
                </ToolbarContainer>
                <ToolbarContainer selection={lastGoodSelection} isVisible={this.isLinkMenuVisible}>
                    <InlineToolbarLinkInput
                        inputRef={this.linkInput}
                        inputValue={this.state.inputValue}
                        onInputChange={this.onInputChange}
                        onInputKeyDown={this.onInputKeyDown}
                        onCloseClick={this.onCloseClick}
                    />
                </ToolbarContainer>
            </React.Fragment>
        ) : null;
        return <div ref={this.selfRef}>{toolbars}</div>;
    }

    /**
     * Mount quill listeners.
     */
    public componentDidMount() {
        document.addEventListener("keydown", this.escFunction, false);
        watchFocusInDomTree(this.selfRef.current!, this.handleFocusChange);

        // Add a key binding for the link popup.
        const keyboard: Keyboard = this.quill.getModule("keyboard");
        keyboard.addBinding(
            {
                key: "k",
                metaKey: true,
            },
            {},
            this.commandKHandler,
        );
    }

    /**
     * Be sure to remove the listeners when the component unmounts.
     */
    public componentWillUnmount() {
        document.removeEventListener("keydown", this.escFunction, false);
    }

    private handleFocusChange = hasRealFocus => {
        this.setState({ hasRealFocus });
        // if (this.state.hasFocus && !hasFocus) {
        //     this.reset();
        // } else if (hasFocus) {
        //     this.setState({ hasFocus });
        // } else {
        //     this.forceUpdate();
        // }
    };

    /**
     * Handle create-link keyboard shortcut.
     */
    private commandKHandler = () => {
        const { lastGoodSelection } = this.props;
        if (
            lastGoodSelection &&
            lastGoodSelection.length &&
            !this.isLinkMenuVisible &&
            !rangeContainsBlot(this.quill, CodeBlot) &&
            !rangeContainsBlot(this.quill, CodeBlockBlot)
        ) {
            if (rangeContainsBlot(this.quill, LinkBlot, lastGoodSelection)) {
                disableAllBlotsInRange(this.quill, LinkBlot, lastGoodSelection);
                this.clearLinkInput();
                this.quill.update(Quill.sources.USER);
            } else {
                const currentText = this.quill.getText(lastGoodSelection.index, lastGoodSelection.length);
                this.focusLinkInput();

                if (isAllowedUrl(currentText)) {
                    this.setState({
                        inputValue: currentText,
                    });
                }
            }
        }
    };

    /**
     * Close the menu.
     */
    private escFunction = (event: KeyboardEvent) => {
        if (event.keyCode === 27) {
            if (this.isLinkMenuVisible) {
                event.preventDefault();
                this.clearLinkInput();
            } else if (this.isFormatMenuVisible) {
                event.preventDefault();
                this.reset(true);
            }
        }
    };

    private reset = (clearSelection: boolean = false) => {
        const { lastGoodSelection } = this.props;
        if (clearSelection && lastGoodSelection) {
            this.quill.setSelection(lastGoodSelection.length + lastGoodSelection.index, 0, Emitter.sources.USER);
        }

        this.setState({
            inputValue: "",
            // hasRealFocus: false,
        });
    };

    /**
     * Handle clicks on the link menu's close button.
     */
    private onCloseClick = (event: React.MouseEvent<any>) => {
        event.preventDefault();
        this.clearLinkInput();
    };

    private get isFocused() {
        const hasCurrentSelectionWithLength = !!this.props.currentSelection && this.props.currentSelection.length > 0;
        return this.state.hasRealFocus || hasCurrentSelectionWithLength;
    }

    private get isFormatMenuVisible(): boolean {
        const { lastGoodSelection } = this.props;
        if (!lastGoodSelection) {
            return false;
        }

        if (rangeContainsBlot(this.quill, CodeBlockBlot, lastGoodSelection)) {
            return false;
        }

        if (this.state.isLinkActive) {
            return false;
        }

        return this.isFocused;
    }

    private get isLinkMenuVisible(): boolean {
        const { lastGoodSelection } = this.props;
        if (!lastGoodSelection) {
            return false;
        }

        if (!this.state.isLinkActive) {
            return false;
        }

        return this.isFocused;
    }

    /**
     * Special formatting for the link blot.
     *
     * @param menuItemData - The current state of the menu item.
     */
    private linkFormatter = (menuItemData: IMenuItemData) => {
        if (menuItemData.active) {
            disableAllBlotsInRange(this.quill, LinkBlot);
            this.clearLinkInput();
        } else {
            this.focusLinkInput();
        }
    };

    /**
     * Be sure to strip out all other formats before formatting as code.
     */
    private codeFormatter(menuItemData: IMenuItemData) {
        const { lastGoodSelection } = this.props;
        if (!lastGoodSelection) {
            return;
        }
        this.quill.removeFormat(lastGoodSelection.index, lastGoodSelection.length, Quill.sources.API);
        this.quill.formatText(
            lastGoodSelection.index,
            lastGoodSelection.length,
            "code-inline",
            !menuItemData.active,
            Quill.sources.USER,
        );
    }

    /**
     * Apply focus to the link input.
     *
     * We need to temporarily stop ignore selection changes for the link menu (it will lose selection).
     */
    private focusLinkInput() {
        this.setState({ isLinkActive: true }, () => {
            this.linkInput.current && this.linkInput.current.focus();
        });
    }

    /**
     * Clear the link menu's input content and hide the link menu.
     */
    private clearLinkInput = () => {
        const { lastGoodSelection } = this.props;
        if (lastGoodSelection) {
            this.quill.setSelection(lastGoodSelection, Emitter.sources.USER);
        }

        this.setState({
            inputValue: "",
            isLinkActive: false,
        });
    };

    /**
     * Handle key-presses for the link toolbar.
     */
    private onInputKeyDown = (event: React.KeyboardEvent<any>) => {
        if (Keyboard.match(event.nativeEvent, "enter")) {
            event.preventDefault();
            this.quill.format("link", this.state.inputValue, Emitter.sources.USER);
            this.clearLinkInput();
        }
    };

    /**
     * Handle changes to the the close menu's input.
     */
    private onInputChange = (event: React.ChangeEvent<any>) => {
        this.setState({ inputValue: event.target.value });
    };
}

export default withEditor(withInstance(InlineToolbar));
