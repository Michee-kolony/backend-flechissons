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

    // Texte (facultatif si le message contient une photo)
    texte: {
      type: String,
      trim: true,
      default: '',
      maxlength: TAILLE_MAX
    },

    // Photo envoyée sur R2 (préfixe messagerie/)
    image: {
      url: { type: String, default: null },
      key: { type: String, default: null }
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

// Un message contient au moins un texte ou une photo
messageSchema.pre('validate', function () {
  if (!this.texte && !this.image?.url) {
    this.invalidate('texte', 'Le message est vide.');
  }
});

messageSchema.index({ conversation: 1, createdAt: -1 });
// Purge mensuelle (services/purgeMessagerie.js)
messageSchema.index({ createdAt: 1 });

const Message =
  mongoose.models.Message ||
  mongoose.model('Message', messageSchema);

Message.TAILLE_MAX = TAILLE_MAX;

module.exports = Message;
