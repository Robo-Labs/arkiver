To run this example:

1. Install dependencies:
  
```bash
$ bun install
```

2. Start postgres database:

```bash
$ docker start -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres
```

3. Run migrations:

```bash
$ bunx drizzle-kit push:pg
```

4. Run the arkiver:

```bash
$ ARKIVE_NAME=example bun run index.ts
```

5. Run drizzle studio:
   
```bash
$ bunx drizzle-kit studio
```