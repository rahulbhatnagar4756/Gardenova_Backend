import express, { Router } from "express";
import auth from "../../../core/middleware/authMiddleware";
import validateRequest from "../../../core/middleware/validateRequest";
import { ruleValidation } from "./ruleValidation"; // Joi schema
import {
  createRule,
  deleteRule,
  getAllRules,
  updateRule,
} from "./ruleController";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Rules
 *   description: API for managing rule-based recommendations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RuleCondition:
 *       type: object
 *       required:
 *         - questionId
 *         - operator
 *         - values
 *       properties:
 *         questionId:
 *           type: string
 *           description: MongoDB ObjectId referencing a question
 *           example: "64f1b5e4a3f2c1d2e3b4a5c6"
 *         operator:
 *           type: string
 *           enum: [equals, in, and, or]
 *           example: "equals"
 *         values:
 *           type: array
 *           items:
 *             type: string
 *           example: ["clay"]
 *
 *     Rule:
 *       type: object
 *       required:
 *         - name
 *         - conditions
 *       properties:
 *         name:
 *           type: string
 *           example: "Smart Irrigation"
 *         conditions:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/RuleCondition"
 *
 *     RuleWithQuestionText:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - conditions
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         conditions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               questionId:
 *                 type: string
 *               questionText:
 *                 type: string
 *               operator:
 *                 type: string
 *               values:
 *                 type: array
 *                 items:
 *                   type: string
 */

/**
 * @swagger
 * /api/v1/admin/rule:
 *   post:
 *     summary: Create a new rule
 *     tags: [Rules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Rule'
 *     responses:
 *       201:
 *         description: Rule created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 */
router.post("/rule", auth, validateRequest(ruleValidation), createRule);

/**
 * @swagger
 * /api/v1/admin/rule/{id}:
 *   put:
 *     summary: Update a rule by ID
 *     tags: [Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Rule'
 *     responses:
 *       200:
 *         description: Rule updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 */
router.put("/rule/:id", auth, validateRequest(ruleValidation), updateRule);

/**
 * @swagger
 * /api/v1/admin/rule/{id}:
 *   delete:
 *     summary: Delete a rule by ID
 *     tags: [Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rule deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 */
router.delete("/rule/:id", auth, deleteRule);

/**
 * @swagger
 * /api/v1/admin/rule:
 *   get:
 *     summary: Get all rules with question text
 *     tags: [Rules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rules retrieved successfully with question text
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     rules:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/RuleWithQuestionText"
 */
router.get("/rule", auth, getAllRules);

export default router;
