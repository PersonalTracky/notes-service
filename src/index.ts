import cors from "cors";
import express from "express";
import path from "path";
import { createClient, RedisClient } from "redis";
import "reflect-metadata";
import { createConnection, getConnection } from "typeorm";
import { __prod__ } from "./constants/constants";
import { Category } from "./entities/Category";
import { Log } from "./entities/Log";
import { Note } from "./entities/Note";
import { User } from "./entities/User";

const main = async () => {
  require("dotenv").config();
  await createConnection({
    type: "postgres",
    url: process.env.DB_URL,
    logging: !__prod__,
    synchronize: !__prod__,
    migrations: [path.join(__dirname, "./migrations/*")],
    entities: [User, Note, Log, Category],
    cli: { migrationsDir: "migrations" },
  });

  const redis = createClient();
  var bodyParser = require("body-parser");
  const app = express();
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.set("trust proxy", true);
  console.log("allowing CORS origin:", process.env.CORS_ORIGIN);
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
      methods: ["POST", "GET", "DELETE", "PUT"],
      allowedHeaders: [
        "access-control-allow-origin",
        "authorization",
        "content-type",
      ],
    })
  );

  app.enable("trust proxy");

  function invalidateCache(redis: RedisClient): void {
    console.log("Invalidating cache...");
    redis.keys("notes:*", function (_err, keys) {
      keys.forEach(function (key) {
        redis.del(key);
      });
    });
  }

  app.post("/paginated-notes", async (req, res) => {
    // Enforcing a maximum limit means that we can not over request even if
    // a high limit is set. Rate limit plus one means that we can look ahead
    // and see if there are more notes in the pagination
    const limit = parseInt(req.body.limit);
    const creatorId = req.body.creatorId;
    const realLimit = Math.min(50, limit);
    const reaLimitPlusOne = realLimit + 1;
    const id = `${process.env.REDIS_PREFIX}:${creatorId}`;
    let notes = null;
    redis.get(id, async (_err, data) => {
      if (data != null) {
        console.log("Retrieved notes from cache...");
        notes = JSON.parse(data);
        res.send({
          notes: notes.slice(0, realLimit),
          hasMore: notes.length === reaLimitPlusOne,
        });
      } else {
        const qb = getConnection()
          .getRepository(Note)
          .createQueryBuilder("n")
          .where('"creatorId" = :creatorId', { creatorId: creatorId })
          .orderBy('"createdAt"', "DESC")
          .limit(reaLimitPlusOne as number);
        if (req.body.cursor) {
          qb.where('"createdAt" < :cursor', {
            cursor: new Date(parseInt(req.body.cursor)),
          });
        }
        notes = await qb.getMany();
        console.log("Retrieved notes from database...");
        redis.setex(
          `${process.env.REDIS_PREFIX}:${creatorId}`,
          3600,
          JSON.stringify(notes)
        );
        res.send({
          notes: notes.slice(0, realLimit),
          hasMore: notes.length === reaLimitPlusOne,
        });
      }
    });
  });

  app.post("/notes", async (req, res) => {
    console.log(
      `Got POST on /notes with user ${req.body.creatorId} from gateway...`
    );
    const note = new Note();
    note.text = req.body.text;
    note.creatorId = req.body.creatorId;
    await note.save();
    console.log("Created new note");
    invalidateCache(redis);
    res.send({ note: note });
  });

  app.put("/notes", async (req, res) => {
    const note = await Note.findOne(req.body.id);
    if (!note) {
      res.send({ error: `No note with id ${req.body.id} found` });
    }
    const text: string = req.body.text;
    note!.text = text;
    await note?.save();
    invalidateCache(redis);
    res.send({ note: note });
  });

  app.delete("/notes", async (req, res) => {
    await Note.delete(req.body.id);
    invalidateCache(redis);
    res.send(true);
  });

  app.listen(parseInt(process.env.PORT!), () => {
    console.log(`Server started on port ${process.env.PORT}`);
  });
};

main().catch((err) => {
  console.error(err);
});
