/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails oncall+relay
 * @format
 * @flow strict-local
 */

// flowlint ambiguous-object-type:error

"use strict";

import * as React from "react";

import { graphql } from "@graphitation/graphql-js-tag";
import { readFileSync } from "fs";
import { buildSchema } from "graphql";
import * as ReactTestRenderer from "react-test-renderer";
import {
  ApolloProvider,
  useMutation,
  useQuery,
  useSubscription,
} from "@apollo/client";
import {
  getFragmentDefinitions,
  getOperationName,
} from "@apollo/client/utilities";
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";

// import { MockEnvironmentContext } from "./ApolloMockPayloadGenerator";
import { ApolloMockClient, createMockClient } from "../index";
import { useEffect, useState } from "react";

// const React = require('react');
// const ReactTestRenderer = require('react-test-renderer');

// const {MockPayloadGenerator, createMockEnvironment} = require('../');
// const {
//   QueryRenderer,
//   createFragmentContainer,
//   createPaginationContainer,
//   createRefetchContainer,
// } = require('react-relay');
// const {
//   graphql,
//   commitMutation,
//   requestSubscription,
//   DefaultHandlerProvider,
// } = require('relay-runtime');

// const {useState, useEffect} = React;

const schema = buildSchema(
  readFileSync(
    require.resolve("relay-test-utils-internal/lib/testschema.graphql"),
    "utf8"
  )
);

// ApolloClient requires a delay until the next tick of the runloop before it updates,
// as per https://www.apollographql.com/docs/react/development-testing/testing/
const delay = () => new Promise((resolve) => setImmediate(resolve));

describe("ReactRelayTestMocker with Containers", () => {
  let client: ApolloMockClient;

  beforeEach(() => {
    client = createMockClient(schema);
  });

  describe("Basic Resolve/Reject Operations", () => {
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    beforeEach(() => {
      const TestQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestFantasticEffortQuery(
          $id: ID = "<default>"
        ) {
          user: node(id: $id) {
            id
            name
          }
        }
      `;
      const TestComponent: React.FC = () => {
        const { data: props, error } = useQuery<{
          user: { id: string; name: string };
        }>(TestQuery as any);
        if (props) {
          return `My id ${props.user.id} and name is ${props.user.name}` as any;
        } else if (error) {
          return <div id="error">{error.message}</div>;
        }
        return <div id="loading">Loading...</div>;
      };
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <ApolloProvider client={client}>
            <TestComponent />
          </ApolloProvider>
        );
      });
    });

    it("should have pending operations in the queue", () => {
      expect(client.mock.getAllOperations().length).toEqual(1);
    });

    it("should return most recent operation", () => {
      const operation = client.mock.getMostRecentOperation();
      expect(getOperationName(operation.query)).toBe(
        "RelayMockEnvironmentWithComponentsTestFantasticEffortQuery"
      );
      expect(operation.variables).toEqual({
        id: "<default>",
      });
    });

    it("should resolve query", async () => {
      // Should render loading state
      expect(() => {
        testComponentTree.root.find((node) => node.props.id === "loading");
      }).not.toThrow();

      await ReactTestRenderer.act(async () => {
        // Make sure request was issued
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation.query, schema)
        );
        await delay();
      });

      // Should render some data
      expect(testComponentTree).toMatchSnapshot();
    });

    it("should reject query", async () => {
      await ReactTestRenderer.act(async () => {
        client.mock.rejectMostRecentOperation(new Error("Uh-oh"));
        await delay();
      });

      const errorMessage = testComponentTree.root.find(
        (node) => node.props.id === "error"
      );
      // Should render error
      expect(errorMessage.props.children).toBe("Uh-oh");
    });

    it("should reject query with function", async () => {
      await ReactTestRenderer.act(async () => {
        client.mock.rejectMostRecentOperation(
          (operation) =>
            new Error(`Uh-oh: ${getOperationName(operation.query)}`)
        );
        await delay();
      });

      const errorMessage = testComponentTree.root.find(
        (node) => node.props.id === "error"
      );
      // Should render error
      expect(errorMessage.props.children).toBe(
        "Uh-oh: RelayMockEnvironmentWithComponentsTestFantasticEffortQuery"
      );
    });

    it("should throw if it unable to find operation", () => {
      expect(client.mock.getAllOperations().length).toEqual(1);
      expect(() => {
        client.mock.findOperation((operation) => false);
      }).toThrow(/Operation was not found/);
    });
  });

  describe("Test Query Renderer with Fragment Container", () => {
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    // beforeEach(() => {
    //   const UserQuery = graphql`
    //     query RelayMockEnvironmentWithComponentsTestImpossibleAwesomenessQuery(
    //       $id: ID = "<default>"
    //       $scale: Float = 1
    //     ) {
    //       user: node(id: $id) {
    //         id
    //         name
    //         ...RelayMockEnvironmentWithComponentsTestProminentSolutionFragment
    //       }
    //     }
    //   `;

    //   const ProfilePictureFragment = graphql`
    //     fragment RelayMockEnvironmentWithComponentsTestProminentSolutionFragment on User {
    //       name
    //       profile_picture(scale: $scale) {
    //         uri
    //       }
    //     }
    //   `;
    //   const ProfilePicture = createFragmentContainer(
    //     (props) => {
    //       return (
    //         <img
    //           id="profile_picture"
    //           src={props.user.profile_picture.uri}
    //           alt={props.user.name}
    //         />
    //       );
    //     },
    //     {
    //       // eslint-disable-next-line relay/graphql-naming
    //       user: ProfilePictureFragment,
    //     }
    //   );
    //   const TestComponent = () => (
    //     <QueryRenderer
    //       environment={client}
    //       query={UserQuery}
    //       variables={{}}
    //       render={({ error, props }) => {
    //         if (props) {
    //           return (
    //             <div>
    //               My id ${props.user.id} and name is ${props.user.name}.
    //               <hr />
    //               <ProfilePicture user={props.user} />
    //             </div>
    //           );
    //         } else if (error) {
    //           return <div>{error.message}</div>;
    //         }
    //         return <div>Loading...</div>;
    //       }}
    //     />
    //   );
    //   ReactTestRenderer.act(() => {
    //     testComponentTree = ReactTestRenderer.create(<TestComponent />);
    //   });
    // });

    xit("should render data", () => {
      client.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation.query, schema)
      );
      expect(testComponentTree).toMatchSnapshot();
    });

    xit("should render data with mock resolvers", () => {
      client.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation.query, schema, {
          Image() {
            return {
              uri: "http://test.com/image-url",
            };
          },
        })
      );
      const image = testComponentTree.root.find(
        (node) => node.props.id === "profile_picture"
      );
      expect(image.props.src).toBe("http://test.com/image-url");
    });
  });

  describe("Test Query Renderer with Pagination Container", () => {
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    // beforeEach(() => {
    //   const UserQuery = graphql`
    //     query RelayMockEnvironmentWithComponentsTestNoticeableSuccessQuery(
    //       $id: ID = "<default>"
    //       $first: Int = 5
    //       $cursor: String = ""
    //     ) {
    //       user: node(id: $id) {
    //         id
    //         name
    //         ...RelayMockEnvironmentWithComponentsTestRobustAwesomenessFragment
    //       }
    //     }
    //   `;

    //   const UserFriendsFragment = graphql`
    //     fragment RelayMockEnvironmentWithComponentsTestRobustAwesomenessFragment on User {
    //       id
    //       friends(first: $first, after: $cursor)
    //         @connection(key: "User_friends") {
    //         edges {
    //           node {
    //             id
    //             name
    //             profile_picture {
    //               uri
    //             }
    //           }
    //         }
    //       }
    //     }
    //   `;
    //   function FriendsListComponent(props) {
    //     const [isLoading, setIsLoading] = useState(props.relay.isLoading());
    //     return (
    //       <>
    //         <ul id="list">
    //           {props.user.friends.edges.map(({ node, cursor }) => {
    //             return (
    //               <li key={node.id}>
    //                 Friend: {node.name}
    //                 <img src={node.profile_picture?.uri} alt={node.name} />
    //               </li>
    //             );
    //           })}
    //         </ul>
    //         {isLoading && <div id="loadingMore">Loading more...</div>}
    //         <button
    //           disabled={isLoading || !props.relay.hasMore()}
    //           onClick={() => {
    //             setIsLoading(true);
    //             props.relay.loadMore(5, () => {
    //               setIsLoading(false);
    //             });
    //           }}
    //           id="loadMore"
    //         />
    //       </>
    //     );
    //   }
    //   const FriendsList = createPaginationContainer(
    //     FriendsListComponent,
    //     {
    //       // eslint-disable-next-line relay/graphql-naming
    //       user: UserFriendsFragment,
    //     },
    //     {
    //       direction: "forward",
    //       getConnectionFromProps(props) {
    //         return props.user.friends;
    //       },
    //       // $FlowFixMe[cannot-spread-interface]
    //       getFragmentVariables(vars, totalCount) {
    //         return {
    //           ...vars,
    //           first: totalCount,
    //         };
    //       },
    //       getVariables(props, { count, cursor }, vars) {
    //         return {
    //           id: props.user.id,
    //           cursor: cursor,
    //           first: count,
    //         };
    //       },
    //       query: UserQuery,
    //     }
    //   );
    //   const TestComponent = () => (
    //     <QueryRenderer
    //       environment={client}
    //       query={UserQuery}
    //       variables={{
    //         id: "my-pagination-test-user-id",
    //       }}
    //       render={({ error, props }) => {
    //         if (props) {
    //           return (
    //             <div>
    //               My id ${props.user.id} and name is ${props.user.name}.
    //               <hr />
    //               <FriendsList user={props.user} />
    //             </div>
    //           );
    //         } else if (error) {
    //           return <div id="error">{error.message}</div>;
    //         }
    //         return <div id="loading">Loading...</div>;
    //       }}
    //     />
    //   );
    //   ReactTestRenderer.act(() => {
    //     testComponentTree = ReactTestRenderer.create(<TestComponent />);
    //   });
    // });

    xit("should render data", () => {
      ReactTestRenderer.act(() => {
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation.query, schema, {
            ID({ path }, generateId) {
              if (path != null && path.join(".") === "user.id") {
                // $FlowFixMe[prop-missing]
                return operation.variables.id;
              }
            },
            User() {
              return {
                name: "Alice",
              };
            },
            PageInfo() {
              return {
                hasNextPage: true,
              };
            },
          })
        );
      });
      const list = testComponentTree.root.find(
        (node) => node.props.id === "list"
      );
      expect(list.props.children).toBeInstanceOf(Array);
      expect(list.props.children.length).toEqual(1);
      expect(
        list.props.children
          .map((li: any) => li.props.children)[0]
          .includes("Alice")
      ).toEqual(true);
      expect(testComponentTree).toMatchSnapshot(
        "It should render list of users with just Alice and `button` loadMore should be enabled."
      );
    });

    xit("should load more data for pagination container", () => {
      ReactTestRenderer.act(() => {
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation.query, schema, {
            ID({ path }, generateId) {
              // Just to make sure we're generating list data for the same parent id
              if (path != null && path.join(".") === "user.id") {
                // $FlowFixMe[prop-missing]
                return operation.variables.id;
              }
              return `my-custom-id-${generateId() + 5}`;
            },
            User() {
              return {
                name: "Alice",
              };
            },
            PageInfo() {
              return {
                hasNextPage: true,
              };
            },
          })
        );
      });
      const loadMore = testComponentTree.root.find(
        (node) => node.props.id === "loadMore"
      );
      expect(loadMore.props.disabled).toBe(false);
      ReactTestRenderer.act(() => {
        loadMore.props.onClick();
      });
      // Should show preloader
      expect(() => {
        testComponentTree.root.find((node) => node.props.id === "loadingMore");
      }).not.toThrow();

      // Resolve pagination request
      // We need to add additional resolvers
      ReactTestRenderer.act(() => {
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation.query, schema, {
            ID({ path }, generateId) {
              // Just to make sure we're generating list data for the same parent id
              if (path != null && path.join(".") === "user.id") {
                // $FlowFixMe[prop-missing]
                return operation.variables.id;
              }
              return `my-custom-id-${generateId() + 10}`;
            },
            User() {
              return {
                name: "Bob",
              };
            },
            PageInfo() {
              return {
                hasNextPage: false,
              };
            },
          })
        );
      });
      const list = testComponentTree.root.find(
        (node) => node.props.id === "list"
      );
      expect(list.props.children).toBeInstanceOf(Array);
      expect(list.props.children.length).toEqual(2);
      const listItems = list.props.children.map((li: any) => li.props.children);
      expect(listItems[0].includes("Alice")).toEqual(true);
      expect(listItems[1].includes("Bob")).toEqual(true);
      expect(testComponentTree).toMatchSnapshot(
        'It should render a list of users with Alice and Bob, button "loadMore" should be disabled'
      );
    });
  });

  describe("Test Query Renderer with Refetch Container", () => {
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    // beforeEach(() => {
    //   const UserQuery = graphql`
    //     query RelayMockEnvironmentWithComponentsTestExceptionalImpactQuery(
    //       $id: ID = "<default>"
    //     ) {
    //       user: node(id: $id) {
    //         id
    //         name
    //         hometown {
    //           ...RelayMockEnvironmentWithComponentsTestUsefulAwesomenessFragment
    //         }
    //       }
    //     }
    //   `;

    //   const PageQuery = graphql`
    //     query RelayMockEnvironmentWithComponentsTestImpressiveResultQuery(
    //       $id: ID!
    //     ) @relay_test_operation {
    //       node(id: $id) {
    //         ...RelayMockEnvironmentWithComponentsTestUsefulAwesomenessFragment
    //       }
    //     }
    //   `;

    //   const PageFragment = graphql`
    //     fragment RelayMockEnvironmentWithComponentsTestUsefulAwesomenessFragment on Page {
    //       id
    //       name
    //       websites
    //     }
    //   `;
    //   function UserHometownComponent(props) {
    //     const [isLoading, setIsLoading] = useState(false);
    //     return (
    //       <>
    //         <div id="hometown">{props.page.name}</div>
    //         <div>Websites: {props.page.websites}</div>
    //         {isLoading && <div id="refetching">Refetching...</div>}
    //         <button
    //           id="refetch"
    //           disabled={isLoading}
    //           onClick={() => {
    //             setIsLoading(true);
    //             props.relay.refetch(
    //               {
    //                 id: props.page.id,
    //               },
    //               null,
    //               () => {
    //                 setIsLoading(false);
    //               }
    //             );
    //           }}
    //         >
    //           Refetch
    //         </button>
    //       </>
    //     );
    //   }
    //   const UserHometown = createRefetchContainer(
    //     UserHometownComponent,
    //     {
    //       // eslint-disable-next-line relay/graphql-naming
    //       page: PageFragment,
    //     },
    //     PageQuery
    //   );
    //   const TestComponent = () => (
    //     <QueryRenderer
    //       environment={client}
    //       query={UserQuery}
    //       variables={{}}
    //       render={({ error, props }) => {
    //         if (props) {
    //           return (
    //             <div>
    //               My id ${props.user.id} and name is ${props.user.name}.
    //               <hr />
    //               <UserHometown page={props.user.hometown} />
    //             </div>
    //           );
    //         } else if (error) {
    //           return <div id="error">{error.message}</div>;
    //         }
    //         return <div id="loading">Loading...</div>;
    //       }}
    //     />
    //   );
    //   ReactTestRenderer.act(() => {
    //     testComponentTree = ReactTestRenderer.create(<TestComponent />);
    //   });
    // });

    xit("should refetch query", () => {
      client.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation.query, schema, {
          Page() {
            return {
              id: "my-page-id",
              name: "PHL",
            };
          },
        })
      );
      // Make sure we're rendered correct hometown
      expect(
        testComponentTree.root.find((node) => node.props.id === "hometown")
          .children
      ).toEqual(["PHL"]);

      const refetch = testComponentTree.root.find(
        (node) => node.props.id === "refetch"
      );
      ReactTestRenderer.act(() => {
        refetch.props.onClick();
      });
      // Should load loading state
      expect(() => {
        testComponentTree.root.find((node) => node.props.id === "refetching");
      }).not.toThrow();

      // Verify the query params
      const operation = client.mock.getMostRecentOperation();
      expect(getOperationName(operation.query)).toBe(
        "RelayMockEnvironmentWithComponentsTestImpressiveResultQuery"
      );
      expect(operation.variables).toEqual({ id: "my-page-id" });

      // Resolve refetch query
      client.mock.resolve(
        operation,
        MockPayloadGenerator.generate(operation.query, schema, {
          Node() {
            return {
              __typename: "Page",
              id: "my-page-id",
              name: "SFO",
            };
          },
        })
      );
      expect(
        testComponentTree.root.find((node) => node.props.id === "hometown")
          .children
      ).toEqual(["SFO"]);
      expect(testComponentTree).toMatchSnapshot(
        "Should render hometown with SFO"
      );
    });
  });

  describe("Test Mutations", () => {
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    beforeEach(async () => {
      const FeedbackFragment = graphql`
        fragment RelayMockEnvironmentWithComponentsTestNoticeableResultFragment on Feedback {
          id
          message {
            text
          }
          doesViewerLike
        }
      `;

      const FeedbackQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestWorldClassAwesomenessQuery(
          $id: ID!
        ) {
          feedback: node(id: $id) {
            ...RelayMockEnvironmentWithComponentsTestNoticeableResultFragment
          }
        }
        ${FeedbackFragment}
      `;

      const FeedbackLikeMutation = graphql`
        mutation RelayMockEnvironmentWithComponentsTestDisruptiveSuccessMutation(
          $input: FeedbackLikeInput
        ) {
          feedbackLike(input: $input) {
            feedback {
              id
              doesViewerLike
            }
          }
        }
      `;

      function FeedbackComponent(props: {
        feedback: {
          id: string;
          message: { text: string };
          doesViewerLike: boolean;
        };
      }) {
        const [busy, setBusy] = useState(false);
        const [errorMessage, setErrorMessage] = useState<string | null>(null);
        const [like] = useMutation(FeedbackLikeMutation, {
          onCompleted: () => {
            setBusy(false);
          },
          onError: (e) => {
            setBusy(false);
            setErrorMessage(e.message);
          },
          optimisticResponse: {
            feedbackLike: {
              __typename: "FeedbackLikeResponsePayload",
              feedback: {
                __typename: "Feedback",
                id: props.feedback.id,
                doesViewerLike: true,
              },
            },
          },
        });
        return (
          <div>
            {errorMessage != null && (
              <span id="errorMessage">{errorMessage}</span>
            )}
            Feedback: {props.feedback.message.text}
            <button
              id="likeButton"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                like({
                  variables: {
                    input: {
                      feedbackId: props.feedback.id,
                    },
                  },
                });
              }}
            >
              {props.feedback.doesViewerLike ?? false ? "Unlike" : "Like"}
            </button>
          </div>
        );
      }

      const TestComponent: React.FC = () => {
        const { data: props, error } = useQuery<{
          feedback: {
            id: string;
            message: { text: string };
            doesViewerLike: boolean;
          };
        }>(FeedbackQuery);
        if (props) {
          return <FeedbackComponent feedback={props.feedback} />;
        } else if (error) {
          return <div id="error">error.message</div>;
        }
        return <div id="loading">Loading...</div>;
      };
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <ApolloProvider client={client}>
            <TestComponent />
          </ApolloProvider>
        );
      });
      await ReactTestRenderer.act(async () => {
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation.query, schema, {
            ID() {
              // $FlowFixMe[prop-missing]
              return operation.variables.id;
            },
            Feedback() {
              return {
                doesViewerLike: false,
              };
            },
          })
        );
        await delay();
      });
    });

    it("should resolve mutation", async () => {
      const likeButton = testComponentTree.root.find(
        (node) => node.props.id === "likeButton"
      );
      expect(likeButton.props.disabled).toBe(false);
      expect(likeButton.props.children).toEqual("Like");
      expect(testComponentTree).toMatchSnapshot(
        'Button should be enabled. Text should be "Like".'
      );

      // Should apply optimistic updates
      await ReactTestRenderer.act(async () => {
        likeButton.props.onClick();
        await delay();
      });

      expect(likeButton.props.disabled).toBe(true);
      expect(likeButton.props.children).toEqual("Unlike");
      expect(testComponentTree).toMatchSnapshot(
        'Should apply optimistic update. Button should says "Unlike". And it should be disabled'
      );
      await ReactTestRenderer.act(async () => {
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation.query, schema, {
            Feedback() {
              return {
                // $FlowFixMe[prop-missing]
                id: operation.variables?.input?.feedbackId,
                doesViewerLike: true,
              };
            },
          })
        );
        await delay();
      });
      expect(likeButton.props.disabled).toBe(false);
      expect(likeButton.props.children).toEqual("Unlike");
      expect(testComponentTree).toMatchSnapshot(
        'Should render response from the server. Button should be enabled. And text still "Unlike"'
      );
    });

    it("should reject mutation", async () => {
      const likeButton = testComponentTree.root.find(
        (node) => node.props.id === "likeButton"
      );
      // Should apply optimistic updates
      ReactTestRenderer.act(() => {
        likeButton.props.onClick();
      });

      // Trigger error
      await ReactTestRenderer.act(async () => {
        client.mock.rejectMostRecentOperation(new Error("Uh-oh"));
        await delay();
      });
      expect(testComponentTree).toMatchSnapshot("Should render error message");
    });
  });

  describe("Subscription Tests", () => {
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    beforeEach(async () => {
      const FeedbackFragment = graphql`
        fragment RelayMockEnvironmentWithComponentsTestImpactfulAwesomenessFragment on Feedback {
          id
          message {
            text
          }
          doesViewerLike
        }
      `;

      const FeedbackQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestRemarkableImpactQuery(
          $id: ID!
        ) {
          feedback: node(id: $id) {
            ...RelayMockEnvironmentWithComponentsTestImpactfulAwesomenessFragment
          }
        }
        ${FeedbackFragment}
      `;

      const FeedbackLikeSubscription = graphql`
        subscription RelayMockEnvironmentWithComponentsTestRemarkableFixSubscription(
          $input: FeedbackLikeInput
        ) {
          feedbackLikeSubscribe(input: $input) {
            feedback {
              id
              doesViewerLike
            }
          }
        }
      `;

      function FeedbackComponent(props: {
        feedback: {
          id: string;
          message: { text: string };
          doesViewerLike: boolean;
        };
      }) {
        // useEffect(() => {
        //   const subscription = requestSubscription(props.environment, {
        //     subscription: FeedbackLikeSubscription,
        //     variables: {
        //       input: {
        //         feedbackId: props.feedback.id,
        //       },
        //     },
        //   });
        //   return () => {
        //     subscription.dispose();
        //   };
        // });
        useSubscription(FeedbackLikeSubscription, {
          variables: {
            input: {
              feedbackId: props.feedback.id,
            },
          },
        });
        return (
          <div>
            Feedback: {props.feedback.message.text}
            <span id="reaction">
              {props.feedback.doesViewerLike ?? false
                ? "Viewer likes it"
                : "Viewer does not like it"}
            </span>
          </div>
        );
      }

      const TestComponent: React.FC = () => {
        const { data: props, error } = useQuery<{
          feedback: {
            id: string;
            message: { text: string };
            doesViewerLike: boolean;
          };
        }>(FeedbackQuery);
        if (props) {
          return <FeedbackComponent feedback={props.feedback} />;
        } else if (error) {
          return <div id="error">error.message</div>;
        }
        return <div id="loading">Loading...</div>;
      };
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <ApolloProvider client={client}>
            <TestComponent />
          </ApolloProvider>
        );
      });
      await ReactTestRenderer.act(async () => {
        client.mock.resolveMostRecentOperation((operation) =>
          MockPayloadGenerator.generate(operation.query, schema, {
            ID() {
              // $FlowFixMe[prop-missing]
              return operation.variables.id;
            },
            Feedback() {
              return {
                doesViewerLike: false,
              };
            },
          })
        );
        await delay();
      });
    });

    it("should resolve subscription", async () => {
      ReactTestRenderer.act(() => {
        expect(testComponentTree).toMatchSnapshot();
      });

      const reaction = testComponentTree.root.find(
        (node) => node.props.id === "reaction"
      );
      expect(reaction.props.children).toBe("Viewer does not like it");

      const operation = client.mock.getMostRecentOperation();
      expect(getOperationName(operation.query)).toBe(
        "RelayMockEnvironmentWithComponentsTestRemarkableFixSubscription"
      );
      // FIXME:
      //   expect(operation.variables).toEqual({
      //     input: {
      //       feedbackId: "my-feedback-id",
      //     },
      //   });

      await ReactTestRenderer.act(async () => {
        client.mock.nextValue(
          operation,
          MockPayloadGenerator.generate(operation.query, schema, {
            Feedback() {
              return {
                // $FlowFixMe[prop-missing]
                id: operation.variables?.input?.feedbackId,
                doesViewerLike: true,
              };
            },
          })
        );
        await delay();
      });
      expect(reaction.props.children).toBe("Viewer likes it");
    });
  });

  describe("Multiple Query Renderers", () => {
    let testComponentTree: ReactTestRenderer.ReactTestRenderer;

    beforeEach(() => {
      const UserQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestSwiftPerformanceQuery(
          $userId: ID!
        ) @relay_test_operation {
          user: node(id: $userId) {
            id
            name
          }
        }
      `;

      const PageQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestRedefiningSolutionQuery(
          $pageId: ID!
        ) @relay_test_operation {
          page: node(id: $pageId) {
            id
            name
          }
        }
      `;

      const TestComponent = () => (
        <>
          <QueryRenderer
            environment={client}
            query={UserQuery}
            variables={{ userId: "my-user-id" }}
            render={({ error, props }) => {
              if (props) {
                return <div id="user">{props.user.name}</div>;
              } else if (error) {
                return <div>{error.message}</div>;
              }
              return <div>Loading...</div>;
            }}
          />
          <QueryRenderer
            environment={client}
            query={PageQuery}
            variables={{ pageId: "my-page-id" }}
            render={({ error, props }) => {
              if (props) {
                return <div id="page">{props.page.name}</div>;
              } else if (error) {
                return <div>{error.message}</div>;
              }
              return <div>Loading...</div>;
            }}
          />
        </>
      );
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(<TestComponent />);
      });
    });

    xit("should resolve both queries", () => {
      const userQuery = client.mock.findOperation(
        (operation) =>
          operation.fragment.node.name ===
          "RelayMockEnvironmentWithComponentsTestSwiftPerformanceQuery"
      );
      const pageQuery = client.mock.findOperation(
        (operation) =>
          operation.fragment.node.name ===
          "RelayMockEnvironmentWithComponentsTestRedefiningSolutionQuery"
      );
      client.mock.resolve(
        userQuery,
        MockPayloadGenerator.generate(userQuery, {
          Node: () => ({
            // $FlowFixMe[prop-missing]
            id: userQuery.request.variables.userId,
            name: "Alice",
          }),
        })
      );
      client.mock.resolve(
        pageQuery,
        MockPayloadGenerator.generate(pageQuery, {
          Node: () => ({
            // $FlowFixMe[prop-missing]
            id: pageQuery.request.variables.pageId,
            name: "My Page",
          }),
        })
      );
      expect(
        testComponentTree.root.find((node) => node.props.id === "user").children
      ).toEqual(["Alice"]);
      expect(
        testComponentTree.root.find((node) => node.props.id === "page").children
      ).toEqual(["My Page"]);
      expect(testComponentTree).toMatchSnapshot();
    });
  });

  describe("resolve/reject next with components", () => {
    let TestComponent;

    beforeEach(() => {
      const UserQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestWorldClassFeatureQuery(
          $userId: ID!
        ) @relay_test_operation {
          user: node(id: $userId) {
            id
            name
          }
        }
      `;

      TestComponent = () => (
        <QueryRenderer
          environment={client}
          query={UserQuery}
          variables={{ userId: "my-user-id" }}
          render={({ error, props }) => {
            if (props) {
              return <div id="user">{props.user.name}</div>;
            } else if (error) {
              return <div id="error">{error.message}</div>;
            }
            return <div>Loading...</div>;
          }}
        />
      );
    });

    xit("should resolve next operation", () => {
      client.mock.queueOperationResolver((operation) =>
        MockPayloadGenerator.generate(operation)
      );
      let testComponentTree;
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(<TestComponent />);
      });
      expect(testComponentTree).toMatchSnapshot(
        "should render component with the data"
      );
    });

    xit("should reject next operation", () => {
      client.mock.queueOperationResolver(() => new Error("Uh-oh"));
      let testComponentTree;
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(<TestComponent />);
      });
      expect(testComponentTree).toMatchSnapshot(
        "should render component with the error"
      );
    });
  });
});
