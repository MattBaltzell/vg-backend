"use strict";

const db = require("../db");
const { sqlForPartialUpdate } = require("../helpers/sql");
const { NotFoundError, BadRequestError } = require("../expressError");

/** Related functions for users. */

class Garden {
  /** Given username, garden name, and description, create garden.
   *
   * Returns { id, plantId, bedId, qty, plantedAt }
   *
   * Throws NotFoundError if garden not found.
   **/

  static async create({ username, name, description }) {
    const gardenRes = await db.query(
      `INSERT INTO gardens
            (name, description)
            VALUES ($1,$2)
            RETURNING id
    `,
      [name, description]
    );

    const { id } = gardenRes.rows[0];

    await db.query(
      `INSERT INTO users_gardens
            (username,garden_id)
            VALUES($1,$2)
        `,
      [username, id]
    );

    return { garden: { id, name, description, users: [username] } };
  }

  /** Given a garden id, return data about garden.
   *
   * Returns { id, plantId, bedId, qty, plantedAt }
   *
   * Throws NotFoundError if garden not found.
   **/
  static async get(id) {
    const gardenRes = await db.query(
      `SELECT   g.id,
                g.name,
                g.description,
                json_agg(ug.username) AS "users"
            FROM users_gardens AS ug
            JOIN gardens AS g
            ON ug.garden_id = g.id
            WHERE id = $1
            GROUP BY g.id`,
      [id]
    );

    const garden = gardenRes.rows[0];

    if (!garden) throw new NotFoundError(`No garden: ${id}`);

    const bedRes = await db.query(
      `SELECT   id, 
                name
            FROM beds
            WHERE garden_id = $1
            ORDER BY name
        `,
      [id]
    );

    garden.beds = bedRes.rows;

    return garden;
  }

  static async findAll(username) {
    const gardenRes = await db.query(
      `SELECT   g.id,
                g.name,
                g.description,
                json_agg(ug.username) AS "users"
            FROM users_gardens AS ug
            JOIN gardens AS g
            ON ug.garden_id = g.id
            WHERE username = $1
            GROUP BY g.id`,
      [username]
    );

    const gardens = gardenRes.rows;
    return gardens;
  }

  /** Update garden data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain
   * all the fields; this only changes provided ones.
   *
   * Data can include:
   *   { name, description }
   *
   * Returns { id, name, description }
   *
   * Throws NotFoundError if not found.
   *
   */

  static async update(id, data) {
    const { setCols, values } = sqlForPartialUpdate(data, {});
    const idVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE gardens 
                      SET ${setCols} 
                      WHERE id = ${idVarIdx} 
                      RETURNING id,
                                name,
                                description`;
    const result = await db.query(querySql, [...values, id]);
    const garden = result.rows[0];

    if (!garden) throw new NotFoundError(`No garden: ${id}`);

    return garden;
  }

  /** Delete given garden from database; returns undefined. */

  static async remove(id) {
    const gardenRes = await db.query(
      `DELETE from gardens
            WHERE id = $1
            RETURNING id, name`,
      [id]
    );

    const garden = gardenRes.rows[0];

    if (!garden) throw new NotFoundError(`No garden: ${id}`);

    return garden;
  }
}

module.exports = Garden;
