import {
  UseAutocompleteProps,
  AutocompleteValue,
  AutocompleteHighlightChangeReason,
  createFilterOptions,
  AutocompleteChangeReason,
  AutocompleteChangeDetails,
  AutocompleteInputChangeReason,
  FilterOptionsState,
} from "@mui/base";
import useControlled from "@mui/utils/useControlled";
import { useCallback, useMemo, useRef } from "react";
import usePromise from "./usePromise";

/**
 * @internal
 * @ignore
 */
type SyncOrAsync<T> = T | Promise<T>;

/**
 * @internal
 * @ignore
 */
export type NonNullableUseAutocompleteProp<
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
 * @internal
 * @ignore
 */
export type NullableUseAutocompleteProp<
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
> = UseAutocompleteProps<Node, Multiple, DisableClearable, FreeSolo>[Prop];

/**
 * Wrapper for free solo values.
 *
 * @remarks FreeSoloNode is always a leaf node.
 */
export class FreeSoloNode<Node> extends String {
  constructor(freeSoloValue: string, readonly parent: Node | null = null) {
    super(freeSoloValue);
  }
}

export type TreeSelectFreeSoloValueMapping<Node, FreeSolo> =
  FreeSolo extends true ? FreeSoloNode<Node> : never;

export type NodeType = "leaf" | "downBranch" | "upBranch";

export function asyncOrAsyncBlock<G extends Generator>(
  it: G
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): G extends Generator<any, infer TReturn, any> ? SyncOrAsync<TReturn> : never {
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
}

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

export type BranchChangeDirection = "up" | "down";

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
      | "getOptionDisabled"
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
      "filterOptions"
    > {
  /**
   * The active **Branch** Node.  This Node's children will be displayed in the select menu.
   */
  branch?: Node | null;

  /**
   * The default branch. Use when the component is not controlled.
   */
  defaultBranch?: Node | null;

  /**
   * If true, the Autocomplete is free solo, meaning that the user input is not bound to provided options.
   */
  freeSolo?: boolean;

  /**
   * Used to determine the string value of a branch path.
   *
   * @remarks `branchPath` ascends ancestors.
   */
  getBranchPathLabel?: (
    branchPath: ReadonlyArray<
      Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>
    >
  ) => string;

  /**
   * Used to determine the string value for a given option.
   * It's used to fill the input (and the list box options if `renderOption` is not provided).
   *
   * @remarks Defaults to `(option:Node) => String(option)`; therefor, implementing a `Node.toString` is an alternative to supplying a custom`getOptionLabel`.
   */
  getOptionLabel?: UseAutocompleteProps<
    Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>,
    Multiple,
    DisableClearable,
    false
  >["getOptionLabel"];

  /**
   * Retrieves the child nodes of `node`.
   *
   * @param node When `null`, {@link useTreeSelect} is requesting root select options.
   *
   * @returns **Child** Nodes or a nullish value when `node` does not have children.
   *
   * @remarks Returning a nullish value indicates that `node` is a **Leaf** Node.
   *
   */
  getChildren: (node: Node | null) => SyncOrAsync<Node[] | null | undefined>;

  /**
   * Retrieves the parent of `node`.
   *
   * @returns **Branch** Node parent of `node` or a nullish value when `node` does not have a parent.
   *
   * @remarks Returning a nullish value indicates that `node` is a root select option.
   */
  getParent: (node: Node) => SyncOrAsync<Node | null | undefined>;

  /**
   * Determines if a select option is a **Branch** or **Leaf** Node.
   *
   * @remarks Overrides default behavior which is to call {@link UseTreeSelectProps.getChildren} and to infer `node` type from the return value.
   */
  isBranch?: (node: Node) => SyncOrAsync<boolean>;

  /**
   * Callback fired when active branch changes.
   *
   * @param direction Indicates the direction of  along the tree.
   */
  onBranchChange?: (
    event: React.SyntheticEvent,
    branchNode: Node | null,
    direction: BranchChangeDirection
  ) => void;

  /**
   * Error Handler for async return values from:
    - {@link UseTreeSelectProps.getParent}
    - {@link UseTreeSelectProps.getChildren}
    - {@link UseTreeSelectProps.isBranch}
    - {@link UseTreeSelectProps.isBranchSelectable}
   */
  onError?: (error: Error) => void;
}

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
  getBranchPathLabel: (
    to: InternalOption<Node, FreeSolo>,
    includeTo: boolean
  ) => string;
  handleOptionClick: (isOptionBranch: boolean) => void;
  loadingOptions: boolean;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultGetOptionDisabled = () => false;

export const useTreeSelect = <
  Node,
  Multiple extends boolean | undefined = undefined,
  DisableClearable extends boolean | undefined = undefined,
  FreeSolo extends boolean | undefined = undefined
>({
  branch: branchProp,
  componentName = "useTreeSelect",
  defaultBranch,
  defaultValue,
  filterOptions: filterOptionsProp = defaultFilterOptions,
  freeSolo,
  getBranchPathLabel: getBranchPathLabelProp,
  getChildren,
  getOptionDisabled: getOptionDisabledProp = defaultGetOptionDisabled,
  getOptionLabel: getOptionLabelProp = defaultGetOptionLabel,
  getParent,
  groupBy: groupByProp,
  inputValue: inputValueProp,
  isBranch: isBranchProp,
  isOptionEqualToValue: isOptionEqualToValueProp,
  multiple,
  onError,
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

  const isBranch = useMemo<Props["isBranch"]>(
    () =>
      isBranchProp ||
      ((node) => {
        const result = getChildren(node);
        if (result instanceof Promise) {
          return result.then((result) => !!result);
        }
        return !!result;
      }),
    [getChildren, isBranchProp]
  );

  const branchPathArg = useMemo(() => {
    if ((curBranch ?? null) === null) {
      return [];
    }
    const branchPath = getPathToNode<Node>(curBranch as Node, getParent);

    if (branchPath instanceof Promise) {
      return branchPath.then((branchPath) => {
        branchPath.unshift(curBranch as Node);
        return branchPath;
      });
    } else {
      branchPath.unshift(curBranch as Node);
      return branchPath;
    }
  }, [curBranch, getParent]);

  const branchPathResult = usePromise(branchPathArg, onError);

  const optionsResult = usePromise(
    useMemo(() => {
      function* getOpts() {
        const options: InternalOption<Node, FreeSolo>[] = [];

        const [branchPath, children] = (yield (() => {
          const children = getChildren(curBranch);

          if (branchPathArg instanceof Promise || children instanceof Promise) {
            return Promise.all([branchPathArg, children]).then(
              ([branchPath, children]) => [branchPath, children || []]
            );
          } else {
            return [branchPathArg, children || []];
          }
        })()) as [Node[], Node[]];

        if (curBranch ?? null !== null) {
          options.push(
            new InternalOption(
              curBranch as Node,
              "upBranch",
              branchPath.slice(1)
            )
          );
        }

        const [childOpts, hasPromise] = children.reduce(
          (results, childNode) => {
            const isBranchResult = isBranch(childNode);

            if (isBranchResult instanceof Promise) {
              results[1] = true;
              results[0].push(
                isBranchResult.then(
                  (isBranch) =>
                    new InternalOption<Node, FreeSolo>(
                      childNode,
                      isBranch ? "downBranch" : "leaf",
                      branchPath
                    )
                )
              );
            } else {
              results[0].push(
                new InternalOption<Node, FreeSolo>(
                  childNode,
                  isBranchResult ? "downBranch" : "leaf",
                  branchPath
                )
              );
            }

            return results;
          },
          [[], false] as [
            childOpts: SyncOrAsync<InternalOption<Node, FreeSolo>>[],
            hasPromise: boolean
          ]
        );

        options.push(
          ...((hasPromise
            ? childOpts
            : yield Promise.all(childOpts)) as InternalOption<Node, FreeSolo>[])
        );

        return options.sort(({ type: a }, { type: b }) => {
          if (a === b) {
            return 0;
          } else if (a === "upBranch") {
            return -1;
          } else if (b === "upBranch") {
            return 1;
          } else if (a === "downBranch") {
            return -1;
          } else if (b === "downBranch") {
            return 1;
          }
          return 0; // This should never happen.
        });
      }

      return asyncOrAsyncBlock(getOpts());
    }, [curBranch, getChildren, branchPathArg, isBranch]),
    onError
  );

  const valueResult = usePromise(
    useMemo(() => {
      if (curValue === null || curValue === undefined) {
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
          const branchPath = getPathToNode<Node>(node, getParent);

          if (branchPath instanceof Promise) {
            hasPromise = true;
            multiValue.push(
              branchPath.then(
                (branchPath) => new InternalOption(node, "leaf", branchPath)
              )
            );
          } else {
            multiValue.push(new InternalOption(node, "leaf", branchPath));
          }
        }

        if (hasPromise) {
          return Promise.all(multiValue);
        } else {
          return multiValue as InternalOption<Node, FreeSolo>[];
        }
      } else {
        const branchPath = getPathToNode<Node>(curValue as Node, getParent);
        return branchPath instanceof Promise
          ? branchPath.then(
              (branchPath) =>
                new InternalOption<Node, FreeSolo>(
                  curValue as Node,
                  "leaf",
                  branchPath
                )
            )
          : new InternalOption<Node, FreeSolo>(
              curValue as Node,
              "leaf",
              branchPath
            );
      }
    }, [curValue, getParent, multiple]),
    onError
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
        ).map((value) => new InternalOption(value, "leaf", []))
      );
    } else {
      valueResult.data ??
        ((curValue ?? null) === null
          ? null
          : new InternalOption(
              curValue as Node | TreeSelectFreeSoloValueMapping<Node, FreeSolo>,
              "leaf",
              []
            ));
    }
  }, [curValue, multiple, valueResult.data]);

  const getOptionDisabled = useCallback<Return["getOptionDisabled"]>(
    ({ node, type }) => {
      if (type === "upBranch" || node instanceof FreeSoloNode) {
        return false;
      }
      return getOptionDisabledProp(node);
    },
    [getOptionDisabledProp]
  );

  const getOptionLabel = useCallback<Return["getOptionLabel"]>(
    ({ node }) => getOptionLabelProp(node),
    [getOptionLabelProp]
  );

  const getBranchPathLabel = useCallback<Return["getBranchPathLabel"]>(
    (to, includeTo) => {
      if (getBranchPathLabelProp) {
        return getBranchPathLabelProp(
          includeTo ? [to.node, ...to.path] : to.path
        );
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
          return `${getOptionLabelProp(node)} > ${label}`;
        }, getOptionLabelProp(first));
      }
    },
    [getBranchPathLabelProp, getOptionLabelProp]
  );

  const groupBy = useMemo<Return["groupBy"]>(() => {
    if (groupByProp) {
      return ({ node, type }) => {
        if (type === "upBranch") {
          return "";
        } else {
          return groupByProp(node);
        }
      };
    }
  }, [groupByProp]);

  const filterOptions = useCallback<Return["filterOptions"]>(
    (options, state) => {
      const [upBranch, optionsMap, freeSoloOptions] = options.reduce(
        (result, option) => {
          if (option.type === "upBranch") {
            result[0] = option;
          } else if (option.node instanceof FreeSoloNode) {
            result[2].push(option);
          } else {
            result[1].set(option.node, option);
          }

          return result;
        },
        [null, new Map(), []] as [
          InternalOption<Node, FreeSolo, NodeType> | null,
          Map<Node, InternalOption<Node, FreeSolo, NodeType>>,
          InternalOption<Node, FreeSolo, NodeType>[]
        ]
      );

      const filteredOptions = filterOptionsProp([...optionsMap.keys()], {
        ...state,
        getOptionLabel: getOptionLabelProp,
      }).map((node) => optionsMap.get(node)) as InternalOption<
        Node,
        FreeSolo,
        NodeType
      >[];

      return upBranch === null
        ? [...filteredOptions, ...freeSoloOptions]
        : [upBranch, ...filteredOptions, ...freeSoloOptions];
    },
    [filterOptionsProp, getOptionLabelProp]
  );

  const isOptionEqualToValue = useCallback<Return["isOptionEqualToValue"]>(
    (option, value) => {
      if (
        option.type === "upBranch" ||
        option.type === "downBranch" ||
        value.type === "upBranch" ||
        value.type === "downBranch"
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

  const isSelectedOptionBranch = useRef(false);

  const onHighlightChange = useCallback<Return["onHighlightChange"]>(
    (event, option, reason) => {
      const { node, type } = option || {};

      isSelectedOptionBranch.current =
        type === "downBranch" || type === "upBranch";

      if (onHighlightChangeProp) {
        onHighlightChangeProp(event, node ?? null, reason);
      }
    },
    [onHighlightChangeProp]
  );

  const handleOptionClick = useCallback((isOptionBranch: boolean) => {
    isSelectedOptionBranch.current = isOptionBranch;
  }, []);

  const onInputChange = useCallback<Return["onInputChange"]>(
    (...args) => {
      const [, , reason] = args;
      if (isSelectedOptionBranch.current && reason === "reset") {
        if (multiple || (value ?? null) === null) {
          args[1] = "";
        } else {
          args[1] = getOptionLabel(
            value as InternalOption<Node, FreeSolo, NodeType>
          );
        }
      }

      if (onInputChangeProp) {
        return onInputChangeProp(...args);
      }

      const [, newInputValue] = args;

      setInputValue(newInputValue);
    },
    [getOptionLabel, multiple, onInputChangeProp, setInputValue, value]
  );

  const onChange = useMemo<Return["onChange"]>(() => {
    const handleBranchChange = (
      event: React.SyntheticEvent<Element, Event>,
      option: InternalOption<Node, FreeSolo>
    ): boolean => {
      const isUpBranch = option.type === "upBranch";

      if (isUpBranch || option.type === "downBranch") {
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
              ...(rawValues as InternalOption<Node, FreeSolo, NodeType>[]).map(
                ({ node }) => node
              ),
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
                typeof newValue === "string" ? "createOption" : "selectOption",
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
                typeof newValue === "string" ? "createOption" : "selectOption",
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

    return (...args): void => handleChange(args, false);
  }, [curBranch, multiple, onBranchChange, onChangeProp, setBranch, setValue]);

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

      if (reason === "selectOption" && isSelectedOptionBranch.current) {
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

  return {
    filterOptions,
    getBranchPathLabel,
    getOptionDisabled,
    getOptionLabel,
    groupBy,
    handleOptionClick,
    inputValue,
    isOptionEqualToValue,
    loadingOptions: branchPathResult.loading || optionsResult.loading,
    onChange,
    onClose,
    onHighlightChange,
    onInputChange,
    onOpen,
    open,
    options: optionsResult.data || [],
    value: value as Return["value"],
  };
};

export default useTreeSelect;