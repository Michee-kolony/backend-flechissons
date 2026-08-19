const Requete = require('../models/requete');

exports.sendRequete = (req, res)=>{

     const requete = new Requete({
        ...req.body
     })

     requete.save()
            .then(()=>res.status(200).json({message: "Requête envoyé avec succès"}))
            .catch(error=>res.status(500).json(error))


}

exports.getRequete = (req, res)=>{

    Requete.find()
           .then(data=>res.status(200).json(data))
           .catch(error=>res.status(500).json(error))

}

exports.getoneRequete = (req, res)=>{

    Requete.findOne({_id:req.params.id})
           .then(data=>res.status(200).json(data))
           .catch(error=>res.status(500).json(error))    

}

exports.deleteRequete = (req, res)=>{

    Requete.deleteOne({_id:req.params.id})
           .then(()=>res.status(201).json({message: "Requête supprimée avec succès"}))
           .catch(error=>res.status(500).json(error))  
}