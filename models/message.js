const mongoose = require('mongoose');


// =====================================================
// MESSAGE D'UNE CONVERSATION (messagerie pasteur / admins ↔ utilisateurs)
// =====================================================

const TAILLE_MAX = 2000;

const messageSchema = new mongoose.Schema(

  {

    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true
    },

    auteur: {
      type: String,
      enum: ['utilisateur', 'admin'],
      required: true
    },

    texte: {
      type: String,
      required: true,
      trim: true,
      maxlength: TAILLE_MAX
    },

    // Date de lecture par le destinataire (null = pas encore lu)
    luLe: {
      type: Date,
      default: null
    }

  },

  {
    timestamps: true
  }

);

messageSchema.index({ conversation: 1, createdAt: -1 });

const Message =
  mongoose.models.Message ||
  mongoose.model('Message', messageSchema);

Message.TAILLE_MAX = TAILLE_MAX;

module.exports = Message;
