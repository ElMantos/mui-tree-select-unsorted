import {
  UseAutocompleteProps,
  AutocompleteValue,
  createFilterOptions,
} from "@mui/material";
import useControlled from "@mui/utils/useControlled";
import React, { useCallback, useMemo, useRef } from "react";
import usePromise from "./usePromise";

export type SyncOrAsync<T> = T | Promise<T>;

/**
 * @internal
 * @ignore
 */
type NonNullableUseAutocompleteProp<
  Prop extends keyof UseAutocompleteProps<
    Node,
    Multiple,
    DisableClearable,
    FreeSolo
  >,
  Node,
  Multiple extends boolean | undefined = undefined,
  DisableClearable extends boolean | undefined = undefined,
  FreeSolo extends boolean | undefined = undefined
> = Required<
  UseAutocompleteProps<Node, Multiple, DisableClearable, FreeSolo>
>[Prop];

/**
 * Wrapper for free solo values.
 *
 * FreeSoloNode is always a leaf node.
 *
 */
export class FreeSoloNode<Node> extends String {
  constructor(freeSoloValue: string, readonly parent: Node | null = null) {
    super(freeSoloValue);
  }
}

export type TreeSelectFreeSoloValueMapping<Node, FreeSolo> =
  FreeSolo extends true ? FreeSoloNode<Node> : never;

/**
 * @internal
 * @ignore
 */
export enum NodeType {
  LEAF,
  DOWN_BRANCH,
  UP_BRANCH,
}

const asyncOrAsyncBlock = <G extends Generator>(
  it: G
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): G extends Generator<any, infer TReturn, any>
  ? SyncOrAsync<TReturn>
  : never => {
  return (function getReturn(
    result: IteratorResult<unknown | Promise<unknown>, unknown>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): SyncOrAsync<any> {
    if (result.done) {
      return result.value;
    } else if (result.value instanceof Promise) {
      return result.value.then((value) => getReturn(it.next(value)));
    } else {
      return getReturn(it.next(result.value));
    }
  })(it.next());
};

/**
 * @internal
 * @ignore
 */
export class InternalOption<
  Node,
  FreeSolo extends boolean | undefined,
  Type extends NodeType = NodeType
> {
  constructor(
    readonly node: Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>,
    readonly type: Type,
    readonly path: ReadonlyArray<Node>
  ) {}

  toString(): string {
    return String(this.node);
  }
}

/**
 * Indicates the tree navigation direction. `"up"` in the direction of ancestors and `"down"`in the direction of descendants.
 */
export type PathDirection = "up" | "down";

/**
 * Utility type that gives the tree select value type.
 */
export type TreeSelectValue<
  Node,
  Multiple extends boolean | undefined,
  DisableClearable extends boolean | undefined,
  FreeSolo extends boolean | undefined
> = AutocompleteValue<
  Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>,
  Multiple,
  DisableClearable,
  false
>;

/**
 * @internal
 * @ignore
 */
export interface UseTreeSelectProps<
  Node,
  Multiple extends boolean | undefined,
  DisableClearable extends boolean | undefined,
  FreeSolo extends boolean | undefined
> extends Pick<
      UseAutocompleteProps<
        Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>,
        Multiple,
        DisableClearable,
        false
      >,
      | "componentName"
      | "defaultValue"
      | "groupBy"
      | "inputValue"
      | "isOptionEqualToValue"
      | "multiple"
      | "onChange"
      | "onClose"
      | "onHighlightChange"
      | "onInputChange"
      | "onOpen"
      | "open"
      | "value"
    >,
    Pick<
      UseAutocompleteProps<Node, Multiple, DisableClearable, false>,
      "filterOptions" | "getOptionDisabled"
    > {
  /**
   * The active **Branch** Node.  This Node's children will be displayed in the select menu.
   */
  branch?: Node | null;

  /**
   * Delimits branches in path labels.
   *
   * @default `" > "`
   */
  branchDelimiter?: string;

  /**
   * The default branch. Use when the component is not controlled.
   */
  defaultBranch?: Node | null;

  /**
   * If true, the Autocomplete is free solo, meaning that the user input is not bound to provided options.
   */
  freeSolo?: FreeSolo;

  /**
   * Used to determine the string value of a path.  `path` ascends ancestors.
   *
   * Uses {@link getOptionLabel} and {@link branchDelimiter} by default.
   */
  getPathLabel?: (
    path: ReadonlyArray<Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>>
  ) => string;

  /**
   * Used to determine the string value for a given option.
   * It's used to fill the input (and the list box options if `renderOption` is not provided).
   *
   * Defaults to `(option:Node) => String(option)`; therefor, implementing a `Node.toString` is an alternative to supplying a custom`getOptionLabel`.
   */
  getOptionLabel?: UseAutocompleteProps<
    Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>,
    Multiple,
    DisableClearable,
    false
  >["getOptionLabel"];

  /**
   * Retrieve the child nodes of `node`.
   *
   * @param node When `null`, the caller is requesting root select options.
   *
   * @returns **Child** Nodes or a nullish value when `node` does not have children.
   *
   * Returning a nullish value indicates that `node` is a **Leaf** Node.
   *
   * @warning Rejections must be handled when returning a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise}.
   */
  getChildren: (node: Node | null) => SyncOrAsync<Node[] | null | undefined>;

  /**
   * Retrieve the parent of `node`.
   *
   * @returns **Branch** Node parent of `node` or a nullish value when `node` does not have a parent.
   *
   * Returning a nullish value indicates that `node` is a root select option.
   *
   * @warning Rejections must be handled when returning a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise}.
   */
  getParent: (node: Node) => SyncOrAsync<Node | null | undefined>;

  /**
   * Determine if an option is a **Branch** or **Leaf** Node.
   *
   * Overrides default behavior which is to call {@link UseTreeSelectProps.getChildren} and to infer `node` type from the return value.
   */
  isBranch?: (node: Node) => SyncOrAsync<boolean>;

  /**
   * Determine if **Branch** Node is selectable as a value.
   *
   * @returns When `true`, will add a **Leaf** option in addition to the **Branch** option for the Node.
   */
  isBranchSelectable?: (node: Node) => SyncOrAsync<boolean>;

  /**
   * Callback fired when active branch changes.
   *
   * @param direction Indicates the direction of  along the tree.
   */
  onBranchChange?: (
    event: React.SyntheticEvent,
    branchNode: Node | null,
    direction: PathDirection
  ) => void;
}

/**
 * @internal
 * @ignore
 */
export interface UseTreeSelectReturn<
  Node,
  Multiple extends boolean | undefined,
  DisableClearable extends boolean | undefined,
  FreeSolo extends boolean | undefined
> extends Required<
      Pick<
        UseAutocompleteProps<
          InternalOption<Node, FreeSolo>,
          Multiple,
          DisableClearable,
          FreeSolo
        >,
        | "filterOptions"
        | "getOptionDisabled"
        | "getOptionLabel"
        | "inputValue"
        | "isOptionEqualToValue"
        | "onChange"
        | "onClose"
        | "onHighlightChange"
        | "onInputChange"
        | "onOpen"
        | "open"
        | "options"
        | "value"
      >
    >,
    Pick<
      UseAutocompleteProps<
        InternalOption<Node, FreeSolo>,
        Multiple,
        DisableClearable,
        FreeSolo
      >,
      "groupBy"
    > {
  getPathLabel: (
    to: InternalOption<Node, FreeSolo>,
    includeTo: boolean
  ) => string;
  onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  handleOptionClick: (
    branchOption: InternalOption<Node, FreeSolo, NodeType>
  ) => void;
  isAtRoot: boolean;
  loadingOptions: boolean;
  noOptions: React.RefObject<boolean>;
}

const getPathToNode = <Node>(
  toNode: Node | FreeSoloNode<Node>,
  getParent: (node: Node) => SyncOrAsync<Node | null | undefined>
) => {
  function* it() {
    const path: Node[] = [];

    let parent =
      ((yield toNode instanceof FreeSoloNode
        ? toNode.parent
        : getParent(toNode)) as Awaited<ReturnType<typeof getParent>>) ?? null;

    while (parent !== null) {
      path.push(parent);
      parent =
        ((yield getParent(parent)) as Awaited<ReturnType<typeof getParent>>) ??
        null;
    }

    return path;
  }

  return asyncOrAsyncBlock(it());
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultFilterOptions = createFilterOptions<any>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultGetOptionLabel = (node: any): string => String(node);

const defaultGetOptionDisabled = () => false;

const defaultIsBranchSelectable = () => false;

/**
 * @internal
 * @ignore
 */
export const useTreeSelect = <
  Node,
  Multiple extends boolean | undefined = undefined,
  DisableClearable extends boolean | undefined = undefined,
  FreeSolo extends boolean | undefined = undefined
>({
  branch: branchProp,
  branchDelimiter = " > ",
  componentName = "useTreeSelect",
  defaultBranch,
  defaultValue,
  filterOptions: filterOptionsProp = defaultFilterOptions,
  freeSolo,
  getPathLabel: getPathLabelProp,
  getChildren,
  getOptionDisabled: getOptionDisabledProp = defaultGetOptionDisabled,
  getOptionLabel: getOptionLabelProp = defaultGetOptionLabel,
  getParent,
  groupBy: groupByProp,
  inputValue: inputValueProp,
  isBranch: isBranchProp,
  isBranchSelectable = defaultIsBranchSelectable,
  isOptionEqualToValue: isOptionEqualToValueProp,
  multiple,
  onBranchChange,
  onChange: onChangeProp,
  onClose: onCloseProp,
  onHighlightChange: onHighlightChangeProp,
  onInputChange: onInputChangeProp,
  onOpen: onOpenProp,
  open: openProp,
  value: valueProp,
}: UseTreeSelectProps<
  Node,
  Multiple,
  DisableClearable,
  FreeSolo
>): UseTreeSelectReturn<Node, Multiple, DisableClearable, FreeSolo> => {
  type Props = Required<
    UseTreeSelectProps<Node, Multiple, DisableClearable, FreeSolo>
  >;
  type Return = UseTreeSelectReturn<Node, Multiple, DisableClearable, FreeSolo>;

  const [inputValue, setInputValue] = useControlled({
    controlled: inputValueProp,
    default: "",
    name: componentName,
    state: "inputValue",
  });

  const [curValue, setValue] = useControlled({
    controlled: valueProp,
    default: multiple && defaultValue === undefined ? [] : defaultValue,
    name: componentName,
    state: "value",
  });

  const [curBranch, setBranch] = useControlled({
    controlled: branchProp,
    default: defaultBranch ?? null,
    name: componentName,
    state: "branch",
  });

  const [open, setOpen] = useControlled({
    controlled: openProp,
    default: false,
    name: componentName,
    state: "open",
  });

  const isBranch = useCallback<Props["isBranch"]>(
    (node) =>
      (
        isBranchProp ||
        ((node) => {
          const result = getChildren(node);
          if (result instanceof Promise) {
            return result.then((result) => !!result);
          }
          return !!result;
        })
      )(node),
    [getChildren, isBranchProp]
  );

  const pathArg = useMemo(() => {
    if ((curBranch ?? null) === null) {
      return [];
    }
    const path = getPathToNode<Node>(curBranch as Node, getParent);

    if (path instanceof Promise) {
      return path.then((path) => {
        path.unshift(curBranch as Node);
        return path;
      });
    } else {
      path.unshift(curBranch as Node);
      return path;
    }
  }, [curBranch, getParent]);

  const pathResult = usePromise(pathArg);

  const optionsResult = usePromise(
    useMemo(() => {
      const options: InternalOption<Node, FreeSolo, NodeType>[] = [];

      function* getOpts() {
        const [path, children] = (yield (() => {
          const children = getChildren(curBranch);

          if (pathArg instanceof Promise || children instanceof Promise) {
            return Promise.all([pathArg, children]).then(([path, children]) => [
              path,
              children || [],
            ]);
          } else {
            return [pathArg, children || []];
          }
        })()) as [Node[], Node[]];

        if (curBranch ?? null !== null) {
          options.push(
            new InternalOption(
              curBranch as Node,
              NodeType.UP_BRANCH,
              path.slice(1)
            )
          );
        }

        options.push(
          ...((yield (() => {
            const options: InternalOption<Node, FreeSolo>[] = [];

            function* parseChildNode(childNode: Node) {
              if ((yield isBranch(childNode)) as boolean) {
                options.push(
                  new InternalOption<Node, FreeSolo>(
                    childNode,
                    NodeType.DOWN_BRANCH,
                    path
                  )
                );

                if (!((yield isBranchSelectable(childNode)) as boolean)) {
                  return;
                }
              }

              options.push(
                new InternalOption<Node, FreeSolo>(
                  childNode,
                  NodeType.LEAF,
                  path
                )
              );
            }

            const promises: Promise<void>[] = [];

            for (const childNode of children) {
              const result = asyncOrAsyncBlock(parseChildNode(childNode));

              if (result instanceof Promise) {
                promises.push(result);
              }
            }

            return promises.length
              ? Promise.all(promises).then(() => options)
              : options;
          })()) as InternalOption<Node, FreeSolo, NodeType>[])
        );

        // return options.sort(({ type: a }, { type: b }) => {
        //   if (a === b) {
        //     return 0;
        //   } else if (a === NodeType.UP_BRANCH) {
        //     return -1;
        //   } else if (b === NodeType.UP_BRANCH) {
        //     return 1;
        //   } else if (a === NodeType.DOWN_BRANCH) {
        //     return -1;
        //   } else if (b === NodeType.DOWN_BRANCH) {
        //     return 1;
        //   }
        //   return 0; // This should never happen.
        // });
      }

      return asyncOrAsyncBlock(getOpts());
    }, [curBranch, getChildren, pathArg, isBranch, isBranchSelectable])
  );

  const valueResult = usePromise(
    useMemo(() => {
      if ((curValue ?? null) === null) {
        return null;
      } else if (multiple) {
        const multiValue: SyncOrAsync<InternalOption<Node, FreeSolo>>[] = [];

        let hasPromise = false;

        for (const node of curValue as AutocompleteValue<
          Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>,
          true,
          true,
          false
        >) {
          const path = getPathToNode<Node>(node, getParent);

          if (path instanceof Promise) {
            hasPromise = true;
            multiValue.push(
              path.then((path) => new InternalOption(node, NodeType.LEAF, path))
            );
          } else {
            multiValue.push(new InternalOption(node, NodeType.LEAF, path));
          }
        }

        if (hasPromise) {
          return Promise.all(multiValue);
        } else {
          return multiValue as InternalOption<Node, FreeSolo>[];
        }
      } else {
        const path = getPathToNode<Node>(curValue as Node, getParent);
        return path instanceof Promise
          ? path.then(
              (path) =>
                new InternalOption<Node, FreeSolo>(
                  curValue as Node,
                  NodeType.LEAF,
                  path
                )
            )
          : new InternalOption<Node, FreeSolo>(
              curValue as Node,
              NodeType.LEAF,
              path
            );
      }
    }, [curValue, getParent, multiple])
  );

  const value = useMemo(() => {
    if (multiple) {
      return (
        valueResult.data ||
        (
          curValue as AutocompleteValue<
            Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>,
            true,
            DisableClearable,
            false
          >
        ).map((value) => new InternalOption(value, NodeType.LEAF, []))
      );
    } else {
      return (
        valueResult.data ??
        ((curValue ?? null) === null
          ? null
          : new InternalOption(
              curValue as Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>,
              NodeType.LEAF,
              []
            ))
      );
    }
  }, [curValue, multiple, valueResult.data]);

  const isOptionEqualToValue = useCallback<Return["isOptionEqualToValue"]>(
    (option, value) => {
      if (
        option.type === NodeType.UP_BRANCH ||
        option.type === NodeType.DOWN_BRANCH ||
        value.type === NodeType.UP_BRANCH ||
        value.type === NodeType.DOWN_BRANCH
      ) {
        return false;
      }

      /**
       * Handle this case:
       * Add freeSolo call to selectNewValue and `multiple === true`
       * https://github.com/mui/material-ui/blob/f8520c409c6682a75e117947c9104a73e30de5c7/packages/mui-base/src/AutocompleteUnstyled/useAutocomplete.js#L622
       */
      const optionNode =
        multiple && freeSolo && typeof option === "string"
          ? (new FreeSoloNode(
              option as string,
              curBranch
            ) as TreeSelectFreeSoloValueMapping<Node, FreeSolo>)
          : option.node;

      if (isOptionEqualToValueProp) {
        return isOptionEqualToValueProp(optionNode, value.node);
      } else if (optionNode instanceof FreeSoloNode) {
        if (value.node instanceof FreeSoloNode) {
          return (
            value.node.toString() === optionNode.toString() &&
            optionNode.parent === value.node.parent
          );
        }
        return false;
      } else if (value.node instanceof FreeSoloNode) {
        return false;
      } else {
        return (
          option.node === value.node &&
          option.path.length === value.path.length &&
          option.path.every((node, index) => node === value.path[index])
        );
      }
    },
    [curBranch, freeSolo, isOptionEqualToValueProp, multiple]
  );

  const getOptionLabel = useCallback<Return["getOptionLabel"]>(
    (arg) =>
      getOptionLabelProp(
        (arg as InternalOption<Node, FreeSolo, NodeType>).node
      ),
    [getOptionLabelProp]
  );

  const options = useMemo(() => {
    if (optionsResult.data) {
      // Determine if "inputValue" should be an "add" free solo option.
      if (
        freeSolo &&
        inputValue &&
        (multiple ||
          !value ||
          getOptionLabel(value as InternalOption<Node, FreeSolo, NodeType>) !==
            inputValue)
      ) {
        const freeSoloOption = new InternalOption(
          new FreeSoloNode(inputValue, curBranch),
          NodeType.LEAF,
          pathResult.data || []
        );

        if (
          (
            (multiple ? value : [value]) as InternalOption<
              Node,
              FreeSolo,
              NodeType
            >[]
          ).every(
            (value) =>
              // NOT the following
              !(
                value &&
                value.node instanceof FreeSoloNode &&
                isOptionEqualToValue(freeSoloOption, value)
              )
          )
        ) {
          return [...optionsResult.data, freeSoloOption];
        }
      }
      return optionsResult.data;
    } else if (curBranch === null) {
      return [];
    } else {
      return [new InternalOption(curBranch as Node, NodeType.UP_BRANCH, [])];
    }
  }, [
    curBranch,
    freeSolo,
    getOptionLabel,
    inputValue,
    isOptionEqualToValue,
    multiple,
    optionsResult.data,
    pathResult.data,
    value,
  ]);

  const getOptionDisabled = useCallback<Return["getOptionDisabled"]>(
    ({ node, type }) => {
      if (type === NodeType.UP_BRANCH || node instanceof FreeSoloNode) {
        return false;
      }
      return getOptionDisabledProp(node);
    },
    [getOptionDisabledProp]
  );

  const getPathLabel = useCallback<Return["getPathLabel"]>(
    (to, includeTo) => {
      if (getPathLabelProp) {
        return getPathLabelProp(includeTo ? [to.node, ...to.path] : to.path);
      } else {
        if (!to.path.length && !includeTo) {
          return "";
        }

        const [first, rest] = (() => {
          if (includeTo) {
            return [to.node, to.path] as const;
          }
          return [to.path[0], to.path.slice(1)] as const;
        })();

        return rest.reduce((label, node) => {
          return `${getOptionLabelProp(node)}${branchDelimiter}${label}`;
        }, getOptionLabelProp(first));
      }
    },
    [getPathLabelProp, getOptionLabelProp, branchDelimiter]
  );

  // Will NEVER be called unless groupByProp is defined
  const handleGroupBy = useCallback<NonNullable<Return["groupBy"]>>(
    ({ node, type }) => {
      if (type === NodeType.UP_BRANCH) {
        return "";
      } else {
        // Will never be called unless groupByProp is defined
        return (groupByProp as Props["groupBy"])(node);
      }
    },
    [groupByProp]
  );
  // handleGroupBy is only assigned to groupBy when groupByProp IS defined
  const groupBy = groupByProp && handleGroupBy;

  const noOptions = useRef<boolean>(
    !options.length ||
      (options.length === 1 && options[0].type === NodeType.UP_BRANCH)
  );
  const filterOptions = useCallback<Return["filterOptions"]>(
    (options, state) => {
      const {
        upBranch,
        freeSoloOptions,
        branchOptionsMap,
        leafOptionsMap,
        optionKeys,
      } = options.reduce(
        (result, option) => {
          if (option.type === NodeType.UP_BRANCH) {
            result.upBranch = option;
          } else if (option.node instanceof FreeSoloNode) {
            result.freeSoloOptions.push(option);
          } else if (option.type === NodeType.DOWN_BRANCH) {
            result.branchOptionsMap.set(option.node, option);
            result.optionKeys.add(option.node);
          } else {
            result.leafOptionsMap.set(option.node, option);
            result.optionKeys.add(option.node);
          }

          return result;
        },
        {
          upBranch: null as InternalOption<Node, FreeSolo, NodeType> | null,
          freeSoloOptions: [] as InternalOption<Node, FreeSolo, NodeType>[],
          branchOptionsMap: new Map<
            Node,
            InternalOption<Node, FreeSolo, NodeType>
          >(),
          leafOptionsMap: new Map<
            Node,
            InternalOption<Node, FreeSolo, NodeType>
          >(),
          optionKeys: new Set<Node>(),
        }
      );

      // Prevent a selected value from filtering against branch options
      // from which it does NOT belong.
      if (
        !multiple &&
        value &&
        state.getOptionLabel(
          value as InternalOption<Node, FreeSolo, NodeType>
        ) === state.inputValue &&
        !options.find((option) =>
          isOptionEqualToValue(
            option,
            value as InternalOption<Node, FreeSolo, NodeType>
          )
        )
      ) {
        return options;
      }

      const filteredOptions = (() => {
        const [branchOptions, leafOptions] = filterOptionsProp(
          Array.from(optionKeys),
          {
            ...state,
            getOptionLabel: getOptionLabelProp,
          }
        ).reduce(
          (filteredOptions, node) => {
            const branchOption = branchOptionsMap.get(node);
            if (branchOption) {
              filteredOptions[0].push(branchOption);
            }
            const leafOption = leafOptionsMap.get(node);
            if (leafOption) {
              filteredOptions[1].push(leafOption);
            }

            return filteredOptions;
          },
          [[], []] as [
            branchOptions: InternalOption<Node, FreeSolo, NodeType>[],
            leafOptions: InternalOption<Node, FreeSolo, NodeType>[]
          ]
        );

        // Sort branch options to top
        return [...branchOptions, ...leafOptions];
      })();

      noOptions.current = !filteredOptions.length && !freeSoloOptions.length;

      return upBranch === null
        ? [...filteredOptions, ...freeSoloOptions]
        : [upBranch, ...filteredOptions, ...freeSoloOptions];
    },
    [
      filterOptionsProp,
      getOptionLabelProp,
      isOptionEqualToValue,
      multiple,
      value,
    ]
  );

  const selectedOption = useRef<InternalOption<
    Node,
    FreeSolo,
    NodeType
  > | null>(null);

  const onHighlightChange = useCallback<Return["onHighlightChange"]>(
    (event, option, reason) => {
      selectedOption.current = option;

      if (onHighlightChangeProp) {
        onHighlightChangeProp(event, option?.node ?? null, reason);
      }
    },
    [onHighlightChangeProp]
  );

  const onInputChange = useCallback<Return["onInputChange"]>(
    (...args) => {
      const [, , reason] = args;
      if (
        selectedOption.current &&
        selectedOption.current.type !== NodeType.LEAF &&
        reason === "reset"
      ) {
        if (multiple || (value ?? null) === null) {
          args[1] = "";
        } else {
          args[1] = getOptionLabel(
            value as InternalOption<Node, FreeSolo, NodeType>
          );
        }
      }

      if (onInputChangeProp) {
        onInputChangeProp(...args);
      }

      const [, newInputValue] = args;

      setInputValue(newInputValue);
    },
    [getOptionLabel, multiple, onInputChangeProp, setInputValue, value]
  );

  const onKeyDown = useCallback<React.KeyboardEventHandler<HTMLDivElement>>(
    (event) => {
      if (
        !selectedOption.current ||
        selectedOption.current.type === NodeType.LEAF ||
        event.which == 229
      ) {
        return;
      } else if (event.key === "ArrowRight") {
        if (selectedOption.current.type === NodeType.DOWN_BRANCH) {
          event.preventDefault();
          // https://github.com/mui/mui-x/issues/1403
          // https://github.com/mui/material-ui/blob/b3645b3fd11dc26a06ea370a41b5bac1026c6792/packages/mui-base/src/AutocompleteUnstyled/useAutocomplete.js#L727
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (event as any)["defaultMuiPrevented"] = true;

          const node = selectedOption.current.node as Node;

          if (onInputChange) {
            onInputChange(event, "", "reset");
          }

          if (onBranchChange) {
            onBranchChange(event, node, "down");
          }

          setBranch(node);
        }
      } else if (event.key === "ArrowLeft") {
        if (selectedOption.current.type === NodeType.UP_BRANCH) {
          event.preventDefault();
          // https://github.com/mui/mui-x/issues/1403
          // https://github.com/mui/material-ui/blob/b3645b3fd11dc26a06ea370a41b5bac1026c6792/packages/mui-base/src/AutocompleteUnstyled/useAutocomplete.js#L727
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (event as any)["defaultMuiPrevented"] = true;

          const node = selectedOption.current.path[0] ?? null;

          if (onInputChange) {
            onInputChange(event, "", "reset");
          }

          if (onBranchChange) {
            onBranchChange(event, node, "up");
          }

          setBranch(node);
        }
      }
    },
    [onBranchChange, onInputChange, setBranch]
  );

  const handleOptionClick = useCallback(
    (branchOption: InternalOption<Node, FreeSolo, NodeType>) => {
      selectedOption.current = branchOption;
    },
    []
  );

  const onChange = useCallback<Return["onChange"]>(
    (...args) => {
      const handleBranchChange = (
        event: React.SyntheticEvent<Element, Event>,
        option: InternalOption<Node, FreeSolo>
      ): boolean => {
        const isUpBranch = option.type === NodeType.UP_BRANCH;

        if (isUpBranch || option.type === NodeType.DOWN_BRANCH) {
          const node = isUpBranch
            ? option.path[0] ?? null
            : (option.node as Node);

          if (onBranchChange) {
            onBranchChange(event, node, isUpBranch ? "up" : "down");
          }

          setBranch(node);

          return true;
        }

        return false;
      };

      /**
       * Allows for recursive call when `autoSelect` and `freeSolo` are `true` and `reason` is "blur" to determine if auto select is selecting an option or creating a free solo value.
       *
       * @internal
       * @ignore
       * */
      const handleChange = (
        args: Parameters<Return["onChange"]>,
        reasonIsBlur: boolean
      ): void => {
        type Value = AutocompleteValue<
          Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>,
          Multiple,
          DisableClearable,
          false
        >;

        const [event, , reason] = args;

        if (multiple) {
          switch (reason) {
            case "selectOption": {
              const [, rawValues, , details] = args as Parameters<
                NonNullableUseAutocompleteProp<
                  "onChange",
                  InternalOption<Node, FreeSolo>,
                  true,
                  DisableClearable,
                  false
                >
              >;

              const [newValue] = rawValues.slice(-1);

              const values = rawValues.map(({ node }) => node);

              // Selected Branch
              if (handleBranchChange(event, newValue)) {
                break;
              }

              if (onChangeProp) {
                (
                  onChangeProp as NonNullable<
                    UseTreeSelectProps<
                      Node,
                      true,
                      DisableClearable,
                      FreeSolo
                    >["onChange"]
                  >
                )(
                  event,
                  values,
                  reasonIsBlur ? "blur" : reason,
                  details
                    ? {
                        ...details,
                        option: newValue.node,
                      }
                    : details
                );
              }

              setValue(values as Value);

              break;
            }
            case "createOption": {
              // make copy of value
              const [, [...rawValues], , details] = args as Parameters<
                NonNullableUseAutocompleteProp<
                  "onChange",
                  InternalOption<Node, FreeSolo>,
                  true,
                  DisableClearable,
                  true
                >
              >;

              const [freeSoloValue] = rawValues.splice(-1) as [string];
              const freeSoloNode = new FreeSoloNode(freeSoloValue, curBranch);

              const values = [
                ...(
                  rawValues as InternalOption<Node, FreeSolo, NodeType>[]
                ).map(({ node }) => node),
                freeSoloNode,
              ];

              if (onChangeProp) {
                (
                  onChangeProp as NonNullable<
                    UseTreeSelectProps<
                      Node,
                      true,
                      DisableClearable,
                      true
                    >["onChange"]
                  >
                )(
                  event,
                  values,
                  reasonIsBlur ? "blur" : reason,
                  details
                    ? {
                        ...details,
                        option: freeSoloNode,
                      }
                    : details
                );
              }

              setValue(values as Value);

              break;
            }
            case "blur": {
              const [, rawValues, , details] = args as Parameters<
                NonNullableUseAutocompleteProp<
                  "onChange",
                  InternalOption<Node, FreeSolo>,
                  true,
                  DisableClearable,
                  FreeSolo
                >
              >;

              const [newValue] = rawValues.slice(-1);

              handleChange(
                [
                  event,
                  args[1],
                  typeof newValue === "string"
                    ? "createOption"
                    : "selectOption",
                  details,
                ],
                true
              );

              break;
            }
            case "removeOption":
            case "clear": {
              const [, rawValues, , details] = args as Parameters<
                NonNullableUseAutocompleteProp<
                  "onChange",
                  InternalOption<Node, FreeSolo>,
                  true,
                  DisableClearable,
                  false
                >
              >;

              const values = rawValues.map(({ node }) => node);

              if (onChangeProp) {
                (
                  onChangeProp as NonNullable<
                    UseTreeSelectProps<
                      Node,
                      true,
                      DisableClearable,
                      FreeSolo
                    >["onChange"]
                  >
                )(
                  event,
                  values,
                  reason,
                  details
                    ? {
                        ...details,
                        option: details.option.node,
                      }
                    : details
                );
              }

              setValue(values as Value);

              break;
            }
          }
        } else {
          switch (reason) {
            case "selectOption": {
              const [, value, , details] = args as Parameters<
                NonNullableUseAutocompleteProp<
                  "onChange",
                  InternalOption<Node, FreeSolo>,
                  false,
                  true,
                  false
                >
              >;

              // Selected Branch
              if (handleBranchChange(event, value)) {
                break;
              }

              if (onChangeProp) {
                (
                  onChangeProp as NonNullable<
                    UseTreeSelectProps<Node, false, false, FreeSolo>["onChange"]
                  >
                )(
                  event,
                  value.node,
                  reasonIsBlur ? "blur" : reason,
                  details
                    ? {
                        ...details,
                        option: value.node,
                      }
                    : details
                );
              }

              setValue(value.node as Value);

              break;
            }
            case "createOption": {
              const [, freeSoloValue, , details] = args as Parameters<
                NonNullableUseAutocompleteProp<
                  "onChange",
                  InternalOption<Node, true>,
                  false,
                  DisableClearable,
                  true
                >
              >;

              const freeSoloNode = new FreeSoloNode(
                freeSoloValue as string,
                curBranch
              );

              if (onChangeProp) {
                (
                  onChangeProp as NonNullable<
                    UseTreeSelectProps<
                      Node,
                      false,
                      DisableClearable,
                      true
                    >["onChange"]
                  >
                )(
                  event,
                  freeSoloNode,
                  reasonIsBlur ? "blur" : reason,
                  details
                    ? {
                        ...details,
                        option: freeSoloNode,
                      }
                    : details
                );
              }

              setValue(freeSoloNode as Value);

              break;
            }
            case "blur": {
              const [, newValue, , details] = args as Parameters<
                NonNullableUseAutocompleteProp<
                  "onChange",
                  InternalOption<Node, FreeSolo>,
                  false,
                  DisableClearable,
                  true
                >
              >;
              handleChange(
                [
                  event,
                  args[1],
                  typeof newValue === "string"
                    ? "createOption"
                    : "selectOption",
                  details,
                ],
                true
              );

              break;
            }
            case "removeOption": //  Note remove only fires for multiple
            case "clear": {
              const [, , , details] = args as Parameters<
                NonNullableUseAutocompleteProp<
                  "onChange",
                  InternalOption<Node, FreeSolo>,
                  false,
                  DisableClearable,
                  FreeSolo
                >
              >;

              if (onChangeProp) {
                (
                  onChangeProp as NonNullable<
                    UseTreeSelectProps<Node, false, false, true>["onChange"]
                  >
                )(
                  event,
                  null,
                  reasonIsBlur ? "blur" : reason,
                  details
                    ? {
                        ...details,
                        option: details.option.node,
                      }
                    : details
                );
              }

              setValue(null as Value);

              break;
            }
          }
        }
      };

      handleChange(args, false);
    },
    [curBranch, multiple, onBranchChange, onChangeProp, setBranch, setValue]
  );

  const onClose = useCallback<
    NonNullableUseAutocompleteProp<
      "onClose",
      InternalOption<Node, FreeSolo>,
      Multiple,
      DisableClearable,
      FreeSolo
    >
  >(
    (...args) => {
      const [, reason] = args;

      if (
        reason === "selectOption" &&
        selectedOption.current &&
        selectedOption.current.type !== NodeType.LEAF
      ) {
        return;
      }

      if (onCloseProp) {
        onCloseProp(...args);
      }

      setOpen(false);
    },
    [onCloseProp, setOpen]
  );

  const onOpen = useCallback<
    NonNullableUseAutocompleteProp<
      "onOpen",
      InternalOption<Node, FreeSolo>,
      Multiple,
      DisableClearable,
      FreeSolo
    >
  >(
    (...args) => {
      if (onOpenProp) {
        onOpenProp(...args);
      }

      setOpen(true);
    },
    [onOpenProp, setOpen]
  );

  const _return = {
    filterOptions,
    getPathLabel,
    getOptionDisabled,
    getOptionLabel,
    groupBy,
    onKeyDown,
    handleOptionClick,
    inputValue,
    isAtRoot: curBranch === null,
    isOptionEqualToValue,
    loadingOptions: pathResult.loading || optionsResult.loading,
    noOptions,
    onChange,
    onClose,
    onHighlightChange,
    onInputChange,
    onOpen,
    open,
    options,
    value: value as Return["value"],
  };

  /**
   * Turn OFF the following warning:
   * https://github.com/mui/material-ui/blob/8f7b7514e64f126f0f2a0ced8dcee252b25c68e9/packages/mui-base/src/AutocompleteUnstyled/useAutocomplete.js#L245
   * Not applicable to Tree Select
   */
  if (process.env.NODE_ENV !== "production") {
    const missingValue = (() => {
      // https://github.com/mui/material-ui/blob/8f7b7514e64f126f0f2a0ced8dcee252b25c68e9/packages/mui-base/src/AutocompleteUnstyled/useAutocomplete.js#L246
      if (value !== null && !freeSolo && _return.options.length > 0) {
        return (
          (multiple ? value : [value]) as InternalOption<
            Node,
            FreeSolo,
            NodeType
          >[]
        ).filter(
          (value2) =>
            !_return.options.some((option) =>
              isOptionEqualToValue(option, value2)
            )
        );
      } else {
        return null;
      }
    })();

    // eslint-disable-next-line react-hooks/rules-of-hooks
    _return.options = useMemo(
      () =>
        missingValue?.length
          ? [..._return.options, ...missingValue]
          : _return.options,
      [_return.options, missingValue]
    );

    const _filterOptions = _return.filterOptions;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    _return.filterOptions = useCallback<typeof _filterOptions>(
      (options, ...rest) =>
        _filterOptions(
          options.filter((option) => !missingValue?.includes(option)),
          ...rest
        ),
      [_filterOptions, missingValue]
    );
  }

  return _return;
};

export default useTreeSelect;
