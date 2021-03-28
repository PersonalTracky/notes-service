import cors from "cors";
import express from "express";
import path from "path";
import { createClient, RedisClient } from "redis";
import "reflect-metadata";
import { createConnection, getConnection } from "typeorm";
import { __prod__ } from "./constants/constants";
import { Note } from "./entities/Note";

const main = async () => {
  require("dotenv").config();
  await createConnection({
    type: "postgres",
    url: process.env.DB_URL,
    logging: !__prod__,
    synchronize: !__prod__,
    migrations: [path.join(__dirname, "./migrations/*")],
    entities: [Note],
    cli: { migrationsDir: "migrations" },
  });

  const redis = createClient({
    url: process.env.REDIS_URL,
  });
  var bodyParser = require("body-parser");
  const app = express();
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.set("trust proxy", true);
  console.log("allowing CORS origin:", process.env.CORS_ORIGIN);
  app.use(
    cors({
      origin: [process.env.CORS_ORIGIN, process.env.CORS_ORIGIN_USER_SERVICE],
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
    let notes = null;

    const qb = getConnection()
      .getRepository(Note)
      .createQueryBuilder("n")
      .where('"creatorId" = :creatorId', { creatorId: creatorId })
      .orderBy('"createdAt"', "DESC")
      .limit(reaLimitPlusOne as number);
    if (req.body.cursor) {
      console.log(typeof req.body.cursor);
      console.log(req.body.cursor);
      qb.where('"createdAt" < :cursor', {
        cursor: req.body.cursor,
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
  });

  app.post("/notes", async (req, res) => {
    console.log(
      `Got POST on /notes with user ${req.body.creatorId} from gateway...`
    );
    const note = new Note();
    note.text = req.body.text;
    note.creatorId = req.body.creatorId;
    note.createdAt = new Date(Date.now()).toISOString();
    note.updatedAt = new Date(Date.now()).toISOString();
    await note.save();
    console.log("Created new note");
    invalidateCache(redis);
    const message = JSON.stringify({
      method: "post",
      creatorId: req.body.creatorId,
      id: note.id,
    });
    redis.publish("note", message);
    res.send({ note: note });
  });

  app.put("/notes", async (req, res) => {
    const note = await Note.findOne(req.body.id);
    if (!note) {
      res.send({ error: `No note with id ${req.body.id} found` });
    }
    const text: string = req.body.text;
    note!.text = text;
    note!.updatedAt = new Date(Date.now()).toISOString();
    await note?.save();
    invalidateCache(redis);
    res.send({ note: note });
  });

  app.delete("/notes", async (req, res) => {
    await Note.delete(req.body.id);
    invalidateCache(redis);
    const message = JSON.stringify({
      method: "delete",
      creatorId: req.body.creatorId,
      id: req.body.id,
    });
    redis.publish("note", message);
    res.send(true);
  });

  app.listen(parseInt(process.env.PORT!), () => {
    console.log(`Server started on port ${process.env.PORT}`);
  });
};

main().catch((err) => {
  console.error(err);
});
