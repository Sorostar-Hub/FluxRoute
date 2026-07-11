/**
 * Indexer entry point.
 *
 * Runs the ledger event processor and the Apollo GraphQL server. Also exposes
 * a lightweight `/health` endpoint for liveness probes.
 */

import express, { type Request, type Response } from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

import { loadConfig } from './config';
import { EventProcessor } from './processor';
import { resolvers, type ResolverContext } from './schema/resolvers';

async function main(): Promise<void> {
  const config = loadConfig();

  const pool = new Pool({ connectionString: config.databaseUrl });
  const processor = new EventProcessor(config, pool);

  // Start the event processor in the background.
  void processor.start();

  // Load the GraphQL schema.
  const schemaPath = resolve(__dirname, './schema/schema.graphql');
  const typeDefs = readFileSync(schemaPath, 'utf8');

  const apollo = new ApolloServer<ResolverContext>({
    typeDefs,
    resolvers,
  });
  await apollo.start();

  const app = express();
  app.use(express.json());

  // Health endpoint.
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // REST fallback for the SDK's useSolver hook and frontend.
  app.get('/api/solvers/:intentId/bids', async (req: Request, res: Response) => {
    try {
      // Return empty bids until solver nodes publish to the indexer.
      res.json({ bids: [] });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Mount Apollo GraphQL middleware.
  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async () => ({ pool }) as ResolverContext,
    }),
  );

  app.listen(config.graphqlPort, () => {
    console.log(`indexer: GraphQL + REST on :${config.graphqlPort}`);
  });

  const shutdown = () => {
    console.log('indexer: shutting down...');
    processor.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main().catch((err) => {
  console.error('indexer: fatal error:', err);
  process.exit(1);
});
