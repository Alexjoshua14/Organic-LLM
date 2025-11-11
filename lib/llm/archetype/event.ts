// export const EventSearchTool = tool({
//   description: "Make up 5 events that fit the expected output format.",
//   inputSchema: z.object({
//     events: z.array(EventSchema).describe("The events to display to the user"),
//   }),
//   outputSchema: z.array(EventSchema),
//   execute: async ({ location }) => {
//     return mockEvents.filter((event) => event.location === location);
//   },
// });
